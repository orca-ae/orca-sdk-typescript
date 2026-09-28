// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import type { Fetch } from '../../../src/internal/builtin-types';
import type { APIGroupList } from '../../../src/resources/discovery';

export type CapturedCall = { url: string; init: RequestInit | undefined };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function makeExtensionClient(
  group: string,
  responseForRequest: (url: string, init: RequestInit | undefined) => Response,
  opts: Partial<OrcaOptions> = {},
): Promise<{ orca: Orca; calls: CapturedCall[] }> {
  const calls: CapturedCall[] = [];
  const groups: APIGroupList = {
    kind: 'APIGroupList',
    groups: [
      {
        name: group,
        versions: [{ group_version: `${group}/v1`, version: 'v1' }],
        preferred_version: { group_version: `${group}/v1`, version: 'v1' },
      },
    ],
  };

  const fetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });
    return url.endsWith('/apis') ? jsonResponse(groups) : responseForRequest(url, init);
  };

  const orca = new Orca({
    apiKey: 'test-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: fetch as unknown as typeof globalThis.fetch,
    ...opts,
  });

  await orca.ensureExtensionAvailable(group);
  calls.length = 0;
  return { orca, calls };
}

export function makeUnavailableExtensionClient(): { orca: Orca; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const fetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });
    return jsonResponse({ kind: 'APIGroupList', groups: [] });
  };

  return {
    orca: new Orca({
      apiKey: 'test-key',
      baseURL: 'https://api.example.test',
      maxRetries: 0,
      fetch: fetch as unknown as typeof globalThis.fetch,
    }),
    calls,
  };
}
