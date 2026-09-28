// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';
import type { OrcaOptions } from '../../../src/client';
import type { MemoryVersion } from '../../../src/resources/memory-stores';

const VERSION_FIXTURE: MemoryVersion = {
  id: 'version_abc',
  memory_id: 'memory_abc',
  created_at: '2026-01-01T00:00:00Z',
  memory_store_id: 'store_abc',
  operation: 'modified',
  type: 'memory_version',
  content_sha256: 'sha256:abc',
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
    return jsonResp(VERSION_FIXTURE);
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

describe('MemoryStores.memoryVersions', () => {
  it('is mounted on memoryStores', () => {
    const { orca } = makeClient();
    expect(orca.memoryStores.memoryVersions).toBeDefined();
  });
});

describe('MemoryVersions.list()', () => {
  const pageBody = {
    data: [VERSION_FIXTURE],
    has_more: false,
    first_id: 'version_abc',
    last_id: 'version_abc',
  };

  it('returns a PageCursor and forwards query params', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));

    const page = await orca.memoryStores.memoryVersions.list('store_abc', {
      limit: 10,
      page: 'cursor-1',
      memory_id: 'memory_abc',
      api_key_id: 'key_abc',
      operation: 'modified',
      'created_at[gte]': '2026-01-01T00:00:00Z',
      'created_at[lte]': '2026-02-01T00:00:00Z',
      view: 'full',
    });

    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toEqual([VERSION_FIXTURE]);
    expect(calls[0]!.url).toContain(
      '/v1/memory_stores/store_abc/memory_versions',
    );
    expect(calls[0]!.url).toContain('limit=10');
    expect(calls[0]!.url).toContain('page=cursor-1');
    expect(calls[0]!.url).toContain('memory_id=memory_abc');
    const search = new URL(calls[0]!.url).searchParams;
    expect(search.get('api_key_id')).toBe('key_abc');
    expect(search.get('operation')).toBe('modified');
    expect(search.get('created_at[gte]')).toBe('2026-01-01T00:00:00Z');
    expect(search.get('created_at[lte]')).toBe('2026-02-01T00:00:00Z');
    expect(search.get('view')).toBe('full');
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.memoryStores.memoryVersions.list(
      'store_abc',
      {},
      { headers: new Headers({ 'X-Test-Header': 'list' }) },
    );

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('list');
  });
});

describe('MemoryVersions.retrieve()', () => {
  it('sends GET to the encoded memory version URL', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memoryVersions.retrieve('store/slash', 'version/slash');

    expect(calls[0]!.url).toContain(
      '/v1/memory_stores/store%2Fslash/memory_versions/version%2Fslash',
    );
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memoryVersions.retrieve('store_abc', 'version_abc', {
      headers: new Headers({ 'X-Test-Header': 'retrieve' }),
    });

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe(
      'retrieve',
    );
  });

  it('forwards view while preserving request options', async () => {
    const { orca, calls } = makeClient();
    await orca.memoryStores.memoryVersions.retrieve(
      'store_abc',
      'version_abc',
      { view: 'full' },
      { headers: new Headers({ 'X-Test-Header': 'retrieve-full' }) },
    );

    expect(new URL(calls[0]!.url).searchParams.get('view')).toBe('full');
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('retrieve-full');
  });
});

describe('MemoryVersions.redact()', () => {
  it('sends POST to the redact sub-path and returns the redacted version', async () => {
    const redacted = { ...VERSION_FIXTURE, redacted_at: '2026-01-01T00:00:00Z' };
    const { orca, calls } = makeClient(async () => jsonResp(redacted));
    const result = await orca.memoryStores.memoryVersions.redact('store_abc', 'version_abc', {
      headers: new Headers({ 'X-Test-Header': 'redact' }),
    });

    expect(calls[0]!.url).toContain(
      '/v1/memory_stores/store_abc/memory_versions/version_abc/redact',
    );
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    const headers = calls[0]!.init?.headers as Headers;
    expect(headers.get('X-Test-Header')).toBe('redact');
    expect(result).toEqual(redacted);
  });
});
