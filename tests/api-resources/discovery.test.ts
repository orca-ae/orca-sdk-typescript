// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Discovery resource (`orca.discovery`).
 */

import { Orca } from '../../src/client';
import type { OrcaOptions } from '../../src/client';
import { ExtensionNotAvailableError } from '../../src/core/error';
import type { APIGroupList, APIResourceList } from '../../src/resources/discovery';
import type { Fetch } from '../../src/internal/builtin-types';

const GROUPS_FIXTURE: APIGroupList = {
  kind: 'APIGroupList',
  groups: [
    {
      name: 'cloud.sn.io',
      versions: [{ group_version: 'cloud.sn.io/v1', version: 'v1' }],
      preferred_version: { group_version: 'cloud.sn.io/v1', version: 'v1' },
    },
  ],
};

const RESOURCE_LIST_FIXTURE: APIResourceList = {
  kind: 'APIResourceList',
  group_version: 'policy.runorca.ai/v1',
  resources: [{ name: 'guardrails', namespaced: true, kind: 'Guardrail' }],
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

  const capturingFetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });
    if (fakeFetch) return fakeFetch(input, init);
    return jsonResp(GROUPS_FIXTURE);
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

describe('Discovery.groups()', () => {
  it('sends GET to exactly {base}/apis', async () => {
    const { orca, calls } = makeClient();
    await orca.discovery.groups();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.example.test/apis');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
    expect((calls[0]!.init?.headers as Headers).get('Authorization')).toBe('Bearer test-key');
  });

  it('returns the parsed group list', async () => {
    const { orca } = makeClient();
    const result = await orca.discovery.groups();

    expect(result.kind).toBe('APIGroupList');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.name).toBe('cloud.sn.io');
    expect(result.groups[0]!.preferred_version.group_version).toBe('cloud.sn.io/v1');
  });

  it('returns an empty groups array on a self-hosted deployment without error', async () => {
    const { orca } = makeClient(async () => jsonResp({ kind: 'APIGroupList', groups: [] }));
    const result = await orca.discovery.groups();

    expect(result.groups).toEqual([]);
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient();
    await orca.discovery.groups({ headers: { 'X-Test-Header': 'discovery' } });

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('discovery');
  });
});

describe('extension group resource discovery', () => {
  it.each([
    {
      name: 'policy',
      group: 'policy.runorca.ai',
      path: '/apis/policy.runorca.ai/v1',
      call: (orca: Orca) => orca.discovery.policyGroupResources({ headers: { 'X-Test': 'policy' } }),
    },
    {
      name: 'pricing',
      group: 'pricing.runorca.ai',
      path: '/apis/pricing.runorca.ai/v1',
      call: (orca: Orca) => orca.discovery.pricingGroupResources({ headers: { 'X-Test': 'pricing' } }),
    },
  ])('discovers $name resources only when the group is advertised', async ({ group, path, call }) => {
    const { orca, calls } = makeClient(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/apis')) {
        return jsonResp({
          kind: 'APIGroupList',
          groups: [
            {
              name: group,
              versions: [{ group_version: `${group}/v1`, version: 'v1' }],
              preferred_version: { group_version: `${group}/v1`, version: 'v1' },
            },
          ],
        });
      }
      return jsonResp(RESOURCE_LIST_FIXTURE);
    });

    const result = await call(orca);

    expect(result.kind).toBe('APIResourceList');
    expect(calls.map((request) => request.url)).toEqual([
      'https://api.example.test/apis',
      `https://api.example.test${path}`,
    ]);
    expect((calls[1]!.init?.headers as Headers).get('X-Test')).toBe(group.split('.')[0]);
  });

  it('rejects before group-resource discovery when the extension is absent', async () => {
    const { orca, calls } = makeClient(async () => jsonResp({ kind: 'APIGroupList', groups: [] }));

    const error = await orca.discovery.policyGroupResources().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ExtensionNotAvailableError);
    expect(error).toMatchObject({ group: 'policy.runorca.ai' });
    expect(calls.map((request) => request.url)).toEqual(['https://api.example.test/apis']);
  });
});
