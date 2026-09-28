// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Versions sub-resource.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { Agent } from '../../../src/resources/agents/agents';
import type { Fetch } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_FIXTURE: Agent = {
  id: 'agent_abc123',
  type: 'agent',
  name: 'Test Agent',
  description: null,
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

type CapturedCall = { url: string; init: RequestInit | undefined };

function makeClient(
  fakeFetch?: Fetch,
  opts: Partial<OrcaOptions> = {},
): { orca: Orca; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const pageBody = { data: [AGENT_FIXTURE], has_more: false };

  const capturingFetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;
    calls.push({ url, init });
    if (fakeFetch) return fakeFetch(input, init);
    return jsonResp(pageBody);
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
// Tests
// ---------------------------------------------------------------------------

describe('Versions.list()', () => {
  it('sends GET to /v1/agents/{id}/versions', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.versions.list('agent_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/agents/agent_abc123/versions');
  });

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient();
    const page = await orca.agents.versions.list('agent_abc123');
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data[0]!.id).toBe(AGENT_FIXTURE.id);
  });

  it('forwards version list query params', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.versions.list('agent_abc123', {
      limit: 25,
      page: 'cursor-1',
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=25');
    expect(url).toContain('page=cursor-1');
  });

  it('URL-encodes agentId', async () => {
    const { orca, calls } = makeClient();
    await orca.agents.versions.list('agent/with/slash');

    expect(calls[0]!.url).toContain('agent%2Fwith%2Fslash');
    expect(calls[0]!.url).not.toContain('/agent/with/slash/versions');
  });

  it('supports pagination iteration', async () => {
    const page1 = {
      data: [{ ...AGENT_FIXTURE, id: 'agent_v1', version: 1 }],
      has_more: true,
      next_page: 'cursor-v2',
    };
    const page2 = {
      data: [{ ...AGENT_FIXTURE, id: 'agent_v2', version: 2 }],
      has_more: false,
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return new Response(JSON.stringify(callCount === 1 ? page1 : page2), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const { orca } = makeClient(fakeFetch);
    const versions: number[] = [];
    for await (const snap of orca.agents.versions.list('agent_abc123')) {
      versions.push(snap.version);
    }

    expect(versions).toEqual([1, 2]);
    expect(callCount).toBe(2);
  });
});
