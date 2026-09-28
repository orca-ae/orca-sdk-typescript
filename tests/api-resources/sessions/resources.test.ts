// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Sessions Resources sub-resource.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import type { Fetch } from '../../../src/internal/builtin-types';
import type { SessionResource } from '../../../src/resources/sessions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESOURCE_FIXTURE: SessionResource = {
  id: 'resource_abc',
  type: 'file',
  file_id: 'file_abc',
  mount_path: '/mnt/file.pdf',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
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
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;
    calls.push({ url, init });
    if (fakeFetch) return fakeFetch(input, init);
    return jsonResp(RESOURCE_FIXTURE);
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
// 1. list()
// ---------------------------------------------------------------------------

describe('Resources.list()', () => {
  const pageBody = {
    data: [RESOURCE_FIXTURE],
    has_more: false,
    first_id: 'resource_abc',
    last_id: 'resource_abc',
  };

  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.sessions.resources.list('session_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/resources',
    );
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('forwards limit and page as query params', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.sessions.resources.list('session_xyz', {
      limit: 10,
      page: 'cursor-abc',
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=10');
    expect(url).toContain('page=cursor-abc');
  });
});

// ---------------------------------------------------------------------------
// 2. add()
// ---------------------------------------------------------------------------

describe('Resources.add()', () => {
  it('sends POST to the resources collection URL', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.resources.add('session_xyz', {
      type: 'file',
      file_id: 'file_doc',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/sessions/session_xyz/resources');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.type).toBe('file');
    expect(body.file_id).toBe('file_doc');
  });
});

// ---------------------------------------------------------------------------
// 3. retrieve()
// ---------------------------------------------------------------------------

describe('Resources.retrieve()', () => {
  it('sends GET to the resource item URL', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.resources.retrieve('session_xyz', 'resource_abc');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/resources/resource_abc',
    );
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });
});

// ---------------------------------------------------------------------------
// 4. update()
// ---------------------------------------------------------------------------

describe('Resources.update()', () => {
  it('sends POST to the resource item URL (not PUT)', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.resources.update('session_xyz', 'resource_abc', {
      authorization_token: 'updated-token',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain(
      '/v1/sessions/session_xyz/resources/resource_abc',
    );
    // updateResource uses POST per the OpenAPI spec
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.authorization_token).toBe('updated-token');
  });
});

// ---------------------------------------------------------------------------
// 5. delete()
// ---------------------------------------------------------------------------

describe('Resources.delete()', () => {
  it('sends DELETE and returns the detached-resource tombstone', async () => {
    const tombstone = { id: 'resource_abc', type: 'session_resource_deleted' as const };
    const { orca, calls } = makeClient(async () => jsonResp(tombstone));
    const result = await orca.sessions.resources.delete('session_xyz', 'resource_abc');

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain(
      '/v1/sessions/session_xyz/resources/resource_abc',
    );
    expect(call.init?.method?.toUpperCase()).toBe('DELETE');
    expect(result).toEqual(tombstone);
  });
});
