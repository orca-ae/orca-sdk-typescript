// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { ExtensionNotAvailableError } from '../../../src/core/error';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';
import type { APIGroupList } from '../../../src/resources/discovery';

export const CLOUD_AVAILABLE: APIGroupList = {
  kind: 'APIGroupList',
  groups: [
    {
      name: 'cloud.sn.io',
      versions: [{ group_version: 'cloud.sn.io/v1', version: 'v1' }],
      preferred_version: { group_version: 'cloud.sn.io/v1', version: 'v1' },
    },
  ],
};

export type CapturedCall = { url: string; init: RequestInit | undefined };

export function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function isDiscoveryURL(url: string): boolean {
  return new URL(url).pathname === '/apis';
}

export async function makeCloudClient(
  response: (url: string, init?: RequestInit) => Response = () => jsonResp({}),
  opts: Partial<OrcaOptions> = {},
): Promise<{ orca: Orca; calls: CapturedCall[] }> {
  const calls: CapturedCall[] = [];
  const fetch: Fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url === 'data:,') return new Response('');
    calls.push({ url, init });
    if (isDiscoveryURL(url)) return jsonResp(CLOUD_AVAILABLE);
    return response(url, init);
  };

  const orca = new Orca({
    apiKey: 'test-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: fetch as unknown as typeof globalThis.fetch,
    ...opts,
  });

  await orca.ensureExtensionAvailable('cloud.sn.io');
  calls.length = 0;
  return { orca, calls };
}

export function makeUnavailableCloudClient(): { orca: Orca; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const orca = new Orca({
    apiKey: 'test-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      calls.push({ url, init });
      return jsonResp({ kind: 'APIGroupList', groups: [] } satisfies APIGroupList);
    }) as unknown as typeof globalThis.fetch,
  });
  return { orca, calls };
}

export async function assertCloudExtensionUnavailable(
  invoke: (orca: Orca) => Promise<unknown>,
): Promise<void> {
  const { orca, calls } = makeUnavailableCloudClient();

  await expect(invoke(orca)).rejects.toBeInstanceOf(ExtensionNotAvailableError);
  expect(calls).toHaveLength(1);
  expect(new URL(calls[0]!.url).pathname).toBe('/apis');
}
