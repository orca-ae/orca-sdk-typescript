// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Agents resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { ExtensionNotAvailableError } from '../../../src/core/error';
import { PageCursor } from '../../../src/core/pagination';
import type { Agent, AgentToolDefinition } from '../../../src/resources/agents/agents';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_FIXTURE: Agent = {
  id: 'agent_abc123',
  type: 'agent',
  name: 'Test Agent',
  description: 'A test agent',
  model: { id: 'claude-sonnet-4-6' },
  system: null,
  mcp_servers: [],
  tools: [],
  skills: [],
  multiagent: null,
  metadata: {},
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type Handlers = Record<string, () => Response>;

function makeFakeFetch(handlers: Handlers): Fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

    const entry = Object.entries(handlers).find(([k]) => url.includes(k));
    if (!entry) throw new Error(`unhandled URL: ${url}`);
    return entry[1]();
  };
}

type CapturedCall = { url: string; init: RequestInit | undefined };

function makeClient(
  fakeFetch?: Fetch,
  opts: Partial<OrcaOptions> = {},
): { orca: Orca; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];

  const capturingFetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });
    if (fakeFetch) return fakeFetch(input, init);
    return jsonResp(AGENT_FIXTURE);
  };

  const orca = new Orca({
    apiKey: 'test-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: capturingFetch as unknown as typeof fetch,
    ...opts,
  });

  return { orca, calls };
}

// ---------------------------------------------------------------------------
// 1. create()
// ---------------------------------------------------------------------------

describe('Agents.create()', () => {
  it('sends POST to /v1/agents with required fields', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.create({ model: 'claude-sonnet-4-6', name: 'demo' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toMatch('/v1/agents');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.model).toBe('claude-sonnet-4-6');
    expect(body.name).toBe('demo');
  });

  it('serializes all optional fields correctly', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.create({
      model: { id: 'claude-opus-4', speed: 'fast', effort: { type: 'high' } },
      name: 'full-agent',
      description: 'A fully-specified agent',
      system: 'You are a helpful assistant.',
      metadata: { team: 'a', project: 'b' },
      mcp_servers: [{ name: 'srv', url: 'https://mcp.example.com' }],
      tools: [
        {
          type: 'agent_toolset',
          configs: {
            lookup: {
              enabled: true,
              permission_policy: { type: 'always_ask' },
            },
          },
          default_config: {
            enabled: true,
            permission_policy: { type: 'always_allow', audit_level: 'strict' },
            provider_default: 'value',
          },
          provider_specific: { enabled: true },
        },
        {
          type: 'custom',
          name: 'lookup_order',
          description: 'Look up an order',
          input_schema: { type: 'object' },
        },
      ],
      skills: [{ type: 'custom', skill_id: 'sk_abc', version: '1', provider_config: { mode: 'x' } }],
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.model).toEqual({
      id: 'claude-opus-4',
      speed: 'fast',
      effort: { type: 'high' },
    });
    expect(body.description).toBe('A fully-specified agent');
    expect(body.system).toBe('You are a helpful assistant.');
    expect(body.metadata).toEqual({ team: 'a', project: 'b' });
    expect(body.mcp_servers).toHaveLength(1);
    expect(body.mcp_servers[0].type).toBeUndefined();
    expect(body.mcp_servers[0].url).toBe('https://mcp.example.com');
    expect(body.tools).toHaveLength(2);
    expect(body.tools[0].configs.lookup.enabled).toBe(true);
    expect(body.tools[0].default_config.provider_default).toBe('value');
    expect(body.tools[0].provider_specific).toEqual({ enabled: true });
    expect(body.tools[1].input_schema).toEqual({ type: 'object' });
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0].version).toBe('1');
    expect(body.skills[0].provider_config).toEqual({ mode: 'x' });
  });

  it('gates guardrail attachments on the policy extension', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({
        '/apis': () =>
          jsonResp({
            kind: 'APIGroupList',
            groups: [
              {
                name: 'policy.runorca.ai',
                versions: [{ group_version: 'policy.runorca.ai/v1', version: 'v1' }],
                preferred_version: { group_version: 'policy.runorca.ai/v1', version: 'v1' },
              },
            ],
          }),
        '/v1/agents': () => jsonResp(AGENT_FIXTURE, 201),
      }),
    );

    await orca.agents.create({
      model: 'model-alpha',
      name: 'guarded-agent',
      guardrail_ids: ['grd_shell'],
    });

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/apis', '/v1/agents']);
    expect(JSON.parse(calls[1]!.init?.body as string).guardrail_ids).toEqual(['grd_shell']);
  });

  it('rejects guardrail attachments before creating an agent when policy is unavailable', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/apis': () => jsonResp({ kind: 'APIGroupList', groups: [] }) }),
    );

    await expect(
      orca.agents.create({
        model: 'model-alpha',
        name: 'guarded-agent',
        guardrail_ids: [],
      }),
    ).rejects.toBeInstanceOf(ExtensionNotAvailableError);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/apis']);
  });

  it('rejects non-discriminated and incomplete custom tools at compile time', () => {
    // @ts-expect-error tools require a recognized type discriminator
    const missingDiscriminator: AgentToolDefinition = {};
    // @ts-expect-error custom tools require description and input_schema
    const incompleteCustom: AgentToolDefinition = { type: 'custom', name: 'lookup_order' };

    expect([missingDiscriminator, incompleteCustom]).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 2. retrieve()
// ---------------------------------------------------------------------------

describe('Agents.retrieve()', () => {
  it('sends GET to the right URL', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.retrieve('agent_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/agents/agent_abc123');
    expect(calls[0]!.init?.method?.toUpperCase() ?? 'GET').toBe('GET');
  });

  it('appends ?version= when version param is supplied', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.retrieve('agent_abc123', { version: 2 });

    expect(calls[0]!.url).toContain('version=2');
  });

  it('does not append version when param is omitted', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.retrieve('agent_abc123');

    expect(calls[0]!.url).not.toContain('version=');
  });

  it('exposes required response fields with their wire nullability', async () => {
    const { orca } = makeClient();
    const agent = await orca.agents.retrieve('agent_abc123');
    const toolCount: number = agent.tools.length;
    const archivedAt: string | null = agent.archived_at;

    expect(toolCount).toBe(0);
    expect(archivedAt).toBeNull();
    expect(agent.multiagent).toBeNull();
  });

  it('URL-encodes agentId with slashes', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.retrieve('agent/with/slash');

    expect(calls[0]!.url).toContain('agent%2Fwith%2Fslash');
    expect(calls[0]!.url).not.toContain('/agent/with/slash');
  });
});

// ---------------------------------------------------------------------------
// 3. update()
// ---------------------------------------------------------------------------

describe('Agents.update()', () => {
  it('sends a versionless partial update to the right URL', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.update('agent_abc123', { name: 'new name' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/agents/agent_abc123');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.version).toBeUndefined();
    expect(body.name).toBe('new name');
  });

  it('passes nullable description field as null', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.update('agent_abc123', {
      version: 1,
      description: null,
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.description).toBeNull();
  });

  it('serializes nullable configuration fields and metadata patches', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.update('agent_abc123', {
      version: 1,
      mcp_servers: null,
      tools: null,
      skills: null,
      multiagent: null,
      metadata: { keep: 'value', remove: null },
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.mcp_servers).toBeNull();
    expect(body.tools).toBeNull();
    expect(body.skills).toBeNull();
    expect(body.multiagent).toBeNull();
    expect(body.metadata).toEqual({ keep: 'value', remove: null });
  });

  it('gates guardrail updates and preserves null clearing semantics', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({
        '/apis': () =>
          jsonResp({
            kind: 'APIGroupList',
            groups: [
              {
                name: 'policy.runorca.ai',
                versions: [{ group_version: 'policy.runorca.ai/v1', version: 'v1' }],
                preferred_version: { group_version: 'policy.runorca.ai/v1', version: 'v1' },
              },
            ],
          }),
        '/v1/agents/agent_abc123': () => jsonResp(AGENT_FIXTURE),
      }),
    );

    await orca.agents.update('agent_abc123', { guardrail_ids: null });

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/apis', '/v1/agents/agent_abc123']);
    expect(JSON.parse(calls[1]!.init?.body as string).guardrail_ids).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. list()
// ---------------------------------------------------------------------------

describe('Agents.list()', () => {
  const pageBody = {
    data: [AGENT_FIXTURE],
    has_more: false,
    first_id: AGENT_FIXTURE.id,
    last_id: AGENT_FIXTURE.id,
  };

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(makeFakeFetch({ '/v1/agents': () => jsonResp(pageBody) }));
    const page = await orca.agents.list();
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.id).toBe(AGENT_FIXTURE.id);
  });

  it('forwards list query params', async () => {
    const { orca, calls } = makeClient(makeFakeFetch({ '/v1/agents': () => jsonResp(pageBody) }));
    await orca.agents.list({
      limit: 50,
      page: 'cursor-1',
      include_archived: true,
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=50');
    expect(url).toContain('page=cursor-1');
    expect(url).toContain('include_archived=true');
  });

  it('supports async iteration over a paged result', async () => {
    const page1 = {
      data: [{ ...AGENT_FIXTURE, id: 'agent_1' }],
      has_more: true,
      last_id: 'agent_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ ...AGENT_FIXTURE, id: 'agent_2' }],
      has_more: false,
      last_id: 'agent_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async (_input, _init) => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const agent of orca.agents.list()) {
      ids.push(agent.id);
    }

    expect(ids).toEqual(['agent_1', 'agent_2']);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. archive()
// ---------------------------------------------------------------------------

describe('Agents.archive()', () => {
  it('sends POST to the /archive sub-path and returns the archived agent', async () => {
    const archived = { ...AGENT_FIXTURE, archived_at: '2026-01-02T00:00:00Z' };
    const { orca, calls } = makeClient(makeFakeFetch({ '/v1/agents/': () => jsonResp(archived) }));
    const result = await orca.agents.archive('agent_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/agents/agent_abc123/archive');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(result).toEqual(archived);
  });

  it('URL-encodes agentId', async () => {
    const { orca, calls } = makeClient(makeFakeFetch({ '/v1/agents/': () => jsonResp(AGENT_FIXTURE) }));
    await orca.agents.archive('agent/slash');

    expect(calls[0]!.url).toContain('agent%2Fslash');
  });
});
