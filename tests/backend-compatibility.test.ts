// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../src/client';
import type { Fetch } from '../src/internal/builtin-types';

type CapturedCall = { url: string; init: RequestInit | undefined };

function makeBackend(baseURL: string): { client: Orca; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const fetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });

    const pathname = new URL(url).pathname;
    const body = pathname.endsWith('/files/file_abc')
      ? {
          id: 'file_abc',
          filename: 'result.txt',
          mime_type: 'text/plain',
          size_bytes: 6,
          created_at: '2026-01-01T00:00:00Z',
        }
      : {
          id: 'agent_abc',
          type: 'agent',
          name: 'Agent',
          model: { id: 'model' },
          version: 1,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return {
    client: new Orca({
      apiKey: 'test-key',
      baseURL,
      fetch,
      maxRetries: 0,
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    }),
    calls,
  };
}

async function exerciseCore(client: Orca): Promise<void> {
  await client.agents.retrieve('agent_abc');
  await client.sessions.files.retrieve('session_abc', 'file_abc');
  await client.triggers.retrieve('trigger_abc');
}

describe('shared backend compatibility', () => {
  it('uses the same canonical core paths from a host root or a legacy union base URL', async () => {
    const hostRoot = makeBackend('https://engine.example.test');
    const legacyUnion = makeBackend('https://distribution.example.test/v1/registry');

    await exerciseCore(hostRoot.client);
    await exerciseCore(legacyUnion.client);

    expect(hostRoot.calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/v1/agents/agent_abc',
      '/v1/sessions/session_abc/files/file_abc',
      '/v1/triggers/trigger_abc',
    ]);
    expect(legacyUnion.calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/v1/agents/agent_abc',
      '/v1/sessions/session_abc/files/file_abc',
      '/v1/triggers/trigger_abc',
    ]);
    for (const call of [...hostRoot.calls, ...legacyUnion.calls]) {
      expect((call.init?.headers as Headers).get('Authorization')).toBe('Bearer test-key');
    }
  });
});
