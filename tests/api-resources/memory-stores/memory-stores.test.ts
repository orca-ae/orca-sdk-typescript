// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the MemoryStores resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { MemoryStore } from '../../../src/resources/memory-stores';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORE_FIXTURE: MemoryStore = {
  id: 'memstore_abc',
  type: 'memory_store',
  name: 'project-notes',
  description: 'Notes for project foo',
  metadata: { team: 'platform' },
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

  const capturingFetch: Fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;
    calls.push({ url, init });
    if (fakeFetch) return fakeFetch(input, init);
    return jsonResp(STORE_FIXTURE);
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
// create()
// ---------------------------------------------------------------------------

describe('MemoryStores.create()', () => {
  it('sends POST to /v1/memory_stores with body', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.create({
      name: 'project-notes',
      description: 'Notes for project foo',
      metadata: { team: 'platform' },
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/memory_stores');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.name).toBe('project-notes');
    expect(body.description).toBe('Notes for project foo');
    expect(body.metadata).toEqual({ team: 'platform' });
  });
});

// ---------------------------------------------------------------------------
// retrieve()
// ---------------------------------------------------------------------------

describe('MemoryStores.retrieve()', () => {
  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.retrieve('memstore_abc');

    expect(calls[0]!.url).toContain('/v1/memory_stores/memstore_abc');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('URL-encodes memoryStoreId', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.retrieve('store/slash');

    expect(calls[0]!.url).toContain('store%2Fslash');
  });

  it('exposes the memory-store response discriminator', async () => {
    const { orca } = makeClient();
    const store = await orca.memoryStores.retrieve('memstore_abc');
    const type: 'memory_store' = store.type;

    expect(type).toBe('memory_store');
  });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe('MemoryStores.update()', () => {
  it('sends POST to the correct URL with body', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.update('memstore_abc', {
      name: 'renamed',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/memory_stores/memstore_abc');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.name).toBe('renamed');
  });

  it('serializes metadata patch with null entries', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.update('memstore_abc', {
      metadata: { keep: 'yes', drop: null },
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.metadata).toEqual({ keep: 'yes', drop: null });
  });
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------

describe('MemoryStores.list()', () => {
  const pageBody = {
    data: [STORE_FIXTURE],
    has_more: false,
    first_id: STORE_FIXTURE.id,
    last_id: STORE_FIXTURE.id,
  };

  it('returns a PageCursor', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    const page = await orca.memoryStores.list();
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/memory_stores');
  });

  it('forwards list filters as query params', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.memoryStores.list({
      limit: 10,
      include_archived: true,
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=10');
    expect(url).toContain('include_archived=true');
  });
});

// ---------------------------------------------------------------------------
// delete()
// ---------------------------------------------------------------------------

describe('MemoryStores.delete()', () => {
  it('sends DELETE and returns the deletion tombstone', async () => {
    const tombstone = { id: 'memstore_abc', type: 'memory_store_deleted' as const };
    const { orca, calls } = makeClient(async () => jsonResp(tombstone));
    const result = await orca.memoryStores.delete('memstore_abc', {
      headers: new Headers({ 'X-Test-Header': 'delete' }),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/memory_stores/memstore_abc');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    const headers = calls[0]!.init?.headers as Headers;
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-Test-Header')).toBe('delete');
    expect(result).toEqual(tombstone);
  });
});

// ---------------------------------------------------------------------------
// archive()
// ---------------------------------------------------------------------------

describe('MemoryStores.archive()', () => {
  it('sends POST to the /archive sub-path', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.archive('memstore_abc');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/memory_stores/memstore_abc/archive',
    );
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
  });
});
