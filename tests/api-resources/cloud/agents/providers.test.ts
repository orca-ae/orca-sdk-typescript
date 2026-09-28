// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the cloud Providers sub-resource (`orca.cloud.agents.providers`).
 */

import { Orca } from '../../../../src/client';
import type { OrcaOptions } from '../../../../src/client';
import { ExtensionNotAvailableError } from '../../../../src/core/error';
import type { AgentProvider } from '../../../../src/resources/cloud/agents/providers';
import type { APIGroupList } from '../../../../src/resources/discovery';
import type { Fetch } from '../../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_FIXTURE: AgentProvider = {
  name: 'openai',
  type: 'openai',
  api_url: 'https://api.openai.example',
  api_version: '2024-01-01',
  api_key_env: 'OPENAI_API_KEY',
  api_key_configured: true,
};

const CLOUD_AVAILABLE: APIGroupList = {
  kind: 'APIGroupList',
  groups: [
    {
      name: 'cloud.sn.io',
      versions: [{ group_version: 'cloud.sn.io/v1', version: 'v1' }],
      preferred_version: { group_version: 'cloud.sn.io/v1', version: 'v1' },
    },
  ],
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isDiscoveryURL(url: string): boolean {
  return new URL(url).pathname === '/apis';
}

type CapturedCall = { url: string; init: RequestInit | undefined };

/**
 * Builds a client and pre-warms its extension-discovery cache against a
 * deployment that advertises `cloud.sn.io`, then clears the call log — so
 * every test below only has to reason about the one request its method
 * under test actually issues, exactly like the non-gated resource tests.
 * Dedicated gating tests (below) construct their own client instead, so
 * they can control what `/apis` returns.
 */
async function makeClient(
  fakeFetch?: Fetch,
  opts: Partial<OrcaOptions> = {},
): Promise<{ orca: Orca; calls: CapturedCall[] }> {
  const calls: CapturedCall[] = [];

  const capturingFetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });
    if (isDiscoveryURL(url)) return jsonResp(CLOUD_AVAILABLE);
    if (fakeFetch) return fakeFetch(input, init);
    return jsonResp(PROVIDER_FIXTURE);
  };

  const orca = new Orca({
    apiKey: 'test-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: capturingFetch as unknown as typeof fetch,
    ...opts,
  });

  await orca.ensureExtensionAvailable('cloud.sn.io');
  calls.length = 0;

  return { orca, calls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Providers.list()', () => {
  it('sends GET to /apis/cloud.sn.io/v1/agents/providers', async () => {
    const providers = [PROVIDER_FIXTURE, { name: 'azure', type: 'azure' }];
    const { orca, calls } = await makeClient(async () => jsonResp(providers));
    const result = await orca.cloud.agents.providers.list();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/apis/cloud.sn.io/v1/agents/providers');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('returns provider objects with expected fields', async () => {
    const { orca } = await makeClient(async () => jsonResp([PROVIDER_FIXTURE]));
    const providers = await orca.cloud.agents.providers.list();

    const p = providers[0]!;
    expect(p.name).toBe('openai');
    expect(p.api_key_configured).toBe(true);
  });
});

describe('Providers.retrieve()', () => {
  it('sends GET to /apis/cloud.sn.io/v1/agents/providers/{name}', async () => {
    const { orca, calls } = await makeClient();
    const provider = await orca.cloud.agents.providers.retrieve('openai');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/apis/cloud.sn.io/v1/agents/providers/openai');
    expect(provider.name).toBe(PROVIDER_FIXTURE.name);
  });

  it('URL-encodes provider name with special characters', async () => {
    const { orca, calls } = await makeClient();
    await orca.cloud.agents.providers.retrieve('my/provider');

    expect(calls[0]!.url).toContain('my%2Fprovider');
    expect(calls[0]!.url).not.toContain('/my/provider');
  });

  it('returns a local provider with expected shape', async () => {
    const localProvider: AgentProvider = {
      name: 'local',
      type: 'local',
      api_url: 'http://localhost:8080',
      api_key_configured: false,
    };
    const { orca } = await makeClient(async () => jsonResp(localProvider));
    const result = await orca.cloud.agents.providers.retrieve('local');

    expect(result.name).toBe('local');
    expect(result.api_key_configured).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Extension gating
// ---------------------------------------------------------------------------

describe('Providers cloud extension gating', () => {
  it('throws ExtensionNotAvailableError (not a 404) when /apis reports groups: []', async () => {
    const calls: CapturedCall[] = [];
    const orca = new Orca({
      apiKey: 'test-key',
      baseURL: 'https://api.example.test',
      maxRetries: 0,
      fetch: (async (input: Request | string | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        calls.push({ url, init });
        if (isDiscoveryURL(url)) {
          return jsonResp({ kind: 'APIGroupList', groups: [] } satisfies APIGroupList);
        }
        return jsonResp(PROVIDER_FIXTURE);
      }) as unknown as typeof fetch,
    });

    await expect(orca.cloud.agents.providers.list()).rejects.toBeInstanceOf(ExtensionNotAvailableError);
    // Only the discovery call went out — the gate must run before the real request.
    expect(calls).toHaveLength(1);
    expect(isDiscoveryURL(calls[0]!.url)).toBe(true);
  });
});
