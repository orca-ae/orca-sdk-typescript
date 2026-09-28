// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Sessions resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { ExtensionNotAvailableError } from '../../../src/core/error';
import { PageCursor } from '../../../src/core/pagination';
import type {
  Session,
  SessionAgent,
  SessionCreateParams,
  SessionUpdateParams,
} from '../../../src/resources/sessions/sessions';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_FIXTURE: SessionAgent = {
  id: 'agent_abc',
  type: 'agent',
  name: 'Test Agent',
  description: null,
  model: { id: 'claude-sonnet-4-6' },
  system: null,
  tools: [],
  mcp_servers: [],
  skills: [],
  multiagent: null,
  version: 1,
};

const SESSION_FIXTURE: Session = {
  id: 'session_xyz',
  type: 'session',
  agent: AGENT_FIXTURE,
  environment_id: 'env_123',
  vault_ids: [],
  status: 'idle',
  title: 'Test Session',
  stats: {},
  outcome_evaluations: [],
  usage: {},
  resources: [],
  metadata: {},
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
    return jsonResp(SESSION_FIXTURE);
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

describe('Sessions.create()', () => {
  it('sends POST to /v1/sessions', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.create({
      agent: 'agent_abc',
      environment_id: 'env_123',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/sessions');
    expect(call.url).not.toContain('/agents/');
    expect(call.init?.method?.toUpperCase()).toBe('POST');
  });

  it('serializes required params in body', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.create({
      agent: 'agent_abc',
      environment_id: 'env_123',
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.agent).toBe('agent_abc');
    expect(body.environment_id).toBe('env_123');
  });

  it('serializes all optional params', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.create({
      agent: { id: 'agent_abc', type: 'agent', version: 2 },
      environment_id: 'env_123',
      vault_ids: ['vault_1', 'vault_2'],
      title: 'My Session',
      metadata: { key: 'value' },
      resources: [{ type: 'file', file_id: 'file_abc' }],
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.agent).toEqual({ id: 'agent_abc', type: 'agent', version: 2 });
    expect(body.vault_ids).toEqual(['vault_1', 'vault_2']);
    expect(body.title).toBe('My Session');
    expect(body.metadata).toEqual({ key: 'value' });
    expect(body.resources).toHaveLength(1);
  });

  it('agent shorthand string serializes correctly', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.create({
      agent: 'agent_shorthand_id',
      environment_id: 'env_123',
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(typeof body.agent).toBe('string');
    expect(body.agent).toBe('agent_shorthand_id');
  });

  it('requires a discriminator on object agent references', () => {
    const params: SessionCreateParams = {
      // @ts-expect-error Object agent references require type: 'agent'.
      agent: { id: 'agent_abc' },
      environment_id: 'env_123',
    };
    expect(params.agent).toEqual({ id: 'agent_abc' });
  });

  it('serializes the shared agent_id compatibility form', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.create({ agent_id: 'agent_abc', environment_id: 'env_123' });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.agent_id).toBe('agent_abc');
    expect(body.agent).toBeUndefined();
  });

  it('serializes agent overrides and initial events without backend-specific rewriting', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.create({
      agent: {
        type: 'agent_with_overrides',
        id: 'agent_abc',
        version: 2,
        system: 'Override system prompt',
      },
      environment_id: 'env_123',
      initial_events: [{ type: 'user.message', content: [{ type: 'text', text: 'Start' }] }],
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.agent.type).toBe('agent_with_overrides');
    expect(body.agent.system).toBe('Override system prompt');
    expect(body.initial_events[0].type).toBe('user.message');
  });

  it('gates session-local guardrail overrides on the policy extension', async () => {
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
        '/v1/sessions': () => jsonResp(SESSION_FIXTURE, 201),
      }),
    );

    await orca.sessions.create({
      agent: {
        type: 'agent_with_overrides',
        id: 'agent_abc',
        guardrail_ids: ['grd_session'],
      },
      environment_id: 'env_123',
    });

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/apis', '/v1/sessions']);
    expect(JSON.parse(calls[1]!.init?.body as string).agent.guardrail_ids).toEqual(['grd_session']);
  });

  it('rejects session-local guardrails before creating a session when policy is unavailable', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/apis': () => jsonResp({ kind: 'APIGroupList', groups: [] }) }),
    );

    await expect(
      orca.sessions.create({
        agent: {
          type: 'agent_with_overrides',
          id: 'agent_abc',
          guardrail_ids: [],
        },
        environment_id: 'env_123',
      }),
    ).rejects.toBeInstanceOf(ExtensionNotAvailableError);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/apis']);
  });
});

// ---------------------------------------------------------------------------
// 2. retrieve()
// ---------------------------------------------------------------------------

describe('Sessions.retrieve()', () => {
  it('sends GET to /v1/sessions/{sessionId}', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.retrieve('session_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/sessions/session_xyz');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('exposes required response collections without undefined checks', async () => {
    const { orca } = makeClient();
    const session = await orca.sessions.retrieve('session_xyz');
    const evaluationCount: number = session.outcome_evaluations.length;

    expect(evaluationCount).toBe(0);
    expect(session.resources).toEqual([]);
    expect(session.archived_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. update()
// ---------------------------------------------------------------------------

describe('Sessions.update()', () => {
  it('sends POST to /v1/sessions/{sessionId}', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.update('session_xyz', { title: 'Updated Title' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/sessions/session_xyz');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.title).toBe('Updated Title');
  });

  it('serializes optional update fields', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.update('session_xyz', {
      agent: {
        tools: [
          {
            type: 'custom',
            name: 'lookup_order',
            description: 'Look up an order',
            input_schema: { type: 'object' },
          },
        ],
        mcp_servers: [{ name: 'orders', type: 'url', url: 'https://mcp.example.com' }],
      },
      vault_ids: ['vault_new'],
      metadata: { updated: 'true' },
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.agent.tools[0].name).toBe('lookup_order');
    expect(body.agent.mcp_servers[0].name).toBe('orders');
    expect(body.vault_ids).toEqual(['vault_new']);
    expect(body.metadata).toEqual({ updated: 'true' });
  });

  it('serializes nulls used to clear session metadata and keys', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.update('session_xyz', {
      metadata: { obsolete: null },
    });

    expect(JSON.parse(calls[0]!.init?.body as string).metadata).toEqual({ obsolete: null });

    await orca.sessions.update('session_xyz', { metadata: null });
    expect(JSON.parse(calls[1]!.init?.body as string).metadata).toBeNull();
  });

  it('does not expose fields removed from UpdateSessionRequest', () => {
    // @ts-expect-error UpdateSessionRequest no longer includes environment_id.
    const invalidEnvironment: SessionUpdateParams = { environment_id: 'env_456' };
    const invalidResources: SessionUpdateParams = {
      // @ts-expect-error UpdateSessionRequest no longer includes resources.
      resources: [{ memory_store: { memory_store_id: 'memstore_abc' } }],
    };
    const invalidAgent: SessionUpdateParams = {
      // @ts-expect-error UpdateSessionRequest accepts overrides, not an agent reference.
      agent: 'agent_abc',
    };

    expect(invalidEnvironment).toEqual({ environment_id: 'env_456' });
    expect(invalidResources).toEqual({
      resources: [{ memory_store: { memory_store_id: 'memstore_abc' } }],
    });
    expect(invalidAgent).toEqual({ agent: 'agent_abc' });
  });
});

// ---------------------------------------------------------------------------
// 4. list()
// ---------------------------------------------------------------------------

describe('Sessions.list()', () => {
  const pageBody = {
    data: [SESSION_FIXTURE],
    has_more: false,
    first_id: SESSION_FIXTURE.id,
    last_id: SESSION_FIXTURE.id,
  };

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(makeFakeFetch({ '/v1/sessions': () => jsonResp(pageBody) }));
    const page = await orca.sessions.list();
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.id).toBe(SESSION_FIXTURE.id);
  });

  it('forwards shared session list params', async () => {
    const { orca, calls } = makeClient(makeFakeFetch({ '/v1/sessions': () => jsonResp(pageBody) }));
    await orca.sessions.list({
      agent_id: 'agent_abc',
      limit: 20,
      include_archived: true,
    });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('agent_id')).toBe('agent_abc');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('include_archived')).toBe('true');
  });

  it('supports async iteration over paged results', async () => {
    const page1 = {
      data: [{ ...SESSION_FIXTURE, id: 'session_1' }],
      has_more: true,
      last_id: 'session_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ ...SESSION_FIXTURE, id: 'session_2' }],
      has_more: false,
      last_id: 'session_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const session of orca.sessions.list()) {
      ids.push(session.id);
    }

    expect(ids).toEqual(['session_1', 'session_2']);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. delete()
// ---------------------------------------------------------------------------

describe('Sessions.delete()', () => {
  it('sends DELETE and returns the session tombstone', async () => {
    const tombstone = { id: 'session_xyz', type: 'session_deleted' as const };
    const { orca, calls } = makeClient(makeFakeFetch({ '/v1/sessions/': () => jsonResp(tombstone) }));
    const deleted = await orca.sessions.delete('session_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/sessions/session_xyz');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(deleted).toEqual(tombstone);
  });
});

// ---------------------------------------------------------------------------
// 6. archive()
// ---------------------------------------------------------------------------

describe('Sessions.archive()', () => {
  it('sends POST and returns the archived session', async () => {
    const archived = { ...SESSION_FIXTURE, archived_at: '2026-01-02T00:00:00Z' };
    const { orca, calls } = makeClient(
      makeFakeFetch({ 'sessions/session_xyz/archive': () => jsonResp(archived) }),
    );
    const result = await orca.sessions.archive('session_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/sessions/session_xyz/archive');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(result).toEqual(archived);
  });
});

// ---------------------------------------------------------------------------
// 7. URL encoding
// ---------------------------------------------------------------------------

describe('URL encoding', () => {
  it('encodes sessionId with special characters', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.retrieve('session/with/slash');

    expect(calls[0]!.url).toContain('session%2Fwith%2Fslash');
    expect(calls[0]!.url).not.toContain('/session/with/slash');
  });
});
