// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';
import type { OrcaOptions } from '../../../src/client';
import type { Memory } from '../../../src/resources/memory-stores';

const MEMORY_FIXTURE: Memory = {
  id: 'memory_abc',
  content: 'Remember this',
  content_sha256: 'sha256:abc',
  content_size_bytes: 13,
  created_at: '2026-01-01T00:00:00Z',
  memory_store_id: 'store_abc',
  memory_version_id: 'version_abc',
  path: 'notes/todo.md',
  type: 'memory',
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
    return jsonResp(MEMORY_FIXTURE);
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

describe('MemoryStores.memories', () => {
  it('is mounted on memoryStores', () => {
    const { orca } = makeClient();
    expect(orca.memoryStores.memories).toBeDefined();
  });

  it('narrows memory-prefix entries returned by list', async () => {
    const prefix = { path: 'notes/', type: 'memory_prefix' as const };
    const { orca } = makeClient(async () => jsonResp({ data: [prefix], next_page: null }));
    const page = await orca.memoryStores.memories.list('store_abc');
    const item = page.data[0]!;

    expect(item.type).toBe('memory_prefix');
    if (item.type === 'memory_prefix') {
      expect(item.path).toBe('notes/');
    }
  });
});

describe('Memories.list()', () => {
  const pageBody = {
    data: [MEMORY_FIXTURE],
    has_more: false,
    first_id: 'memory_abc',
    last_id: 'memory_abc',
  };

  it('returns a PageCursor and forwards list params', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));

    const page = await orca.memoryStores.memories.list('store_abc', {
      limit: 10,
      page: 'cursor-1',
      depth: 1,
      path_prefix: 'notes/',
      view: 'full',
    });

    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toEqual([MEMORY_FIXTURE]);
    expect(calls[0]!.url).toContain('/v1/memory_stores/store_abc/memories');
    expect(calls[0]!.url).toContain('limit=10');
    expect(calls[0]!.url).toContain('page=cursor-1');
    expect(calls[0]!.url).toContain('depth=1');
    expect(calls[0]!.url).toContain('path_prefix=notes%2F');
    expect(calls[0]!.url).toContain('view=full');
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.memoryStores.memories.list(
      'store_abc',
      {},
      { headers: new Headers({ 'X-Test-Header': 'list' }) },
    );

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('list');
  });
});

describe('Memories.create()', () => {
  it('sends POST with body and view query param', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memories.create('store_abc', {
      body: { path: 'notes/todo.md', content: 'Remember this' },
      view: 'full',
    });

    expect(calls[0]!.url).toContain('/v1/memory_stores/store_abc/memories');
    expect(calls[0]!.url).toContain('view=full');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      path: 'notes/todo.md',
      content: 'Remember this',
    });
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memories.create(
      'store_abc',
      { body: { path: 'notes/todo.md', content: 'Remember this' } },
      { headers: new Headers({ 'X-Test-Header': 'create' }) },
    );

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe(
      'create',
    );
  });
});

describe('Memories.retrieve()', () => {
  it('sends GET to the encoded memory URL with view query param', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memories.retrieve('store/slash', 'memory/slash', {
      view: 'full',
    });

    expect(calls[0]!.url).toContain(
      '/v1/memory_stores/store%2Fslash/memories/memory%2Fslash',
    );
    expect(calls[0]!.url).toContain('view=full');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memories.retrieve(
      'store_abc',
      'memory_abc',
      {},
      { headers: new Headers({ 'X-Test-Header': 'retrieve' }) },
    );

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe(
      'retrieve',
    );
  });
});

describe('Memories.update()', () => {
  it('sends POST with body and view query param', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memories.update('store_abc', 'memory_abc', {
      body: { content: 'Updated' },
      view: 'basic',
    });

    expect(calls[0]!.url).toContain(
      '/v1/memory_stores/store_abc/memories/memory_abc',
    );
    expect(calls[0]!.url).toContain('view=basic');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({ content: 'Updated' });
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memories.update(
      'store_abc',
      'memory_abc',
      { body: { content: 'Updated' } },
      { headers: new Headers({ 'X-Test-Header': 'update' }) },
    );

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe(
      'update',
    );
  });
});

describe('Memories.delete()', () => {
  it('sends DELETE with expected_content_sha256 query param', async () => {
    const tombstone = { id: 'memory_abc', type: 'memory_deleted' as const };
    const { orca, calls } = makeClient(async () => jsonResp(tombstone));
    const result = await orca.memoryStores.memories.delete(
      'store_abc',
      'memory_abc',
      {
        expected_content_sha256: 'sha256:abc',
      },
      { headers: new Headers({ 'X-Test-Header': 'delete' }) },
    );

    expect(calls[0]!.url).toContain(
      '/v1/memory_stores/store_abc/memories/memory_abc',
    );
    expect(calls[0]!.url).toContain('expected_content_sha256=sha256%3Aabc');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    const headers = calls[0]!.init?.headers as Headers;
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-Test-Header')).toBe('delete');
    expect(result).toEqual(tombstone);
  });
});
