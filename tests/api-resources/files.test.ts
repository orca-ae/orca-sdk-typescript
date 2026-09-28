// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Files resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../src/client';
import type { OrcaOptions } from '../../src/client';
import { PageCursor } from '../../src/core/pagination';
import type { Fetch, RequestInfo } from '../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FILE_FIXTURE = {
  id: 'file_abc123',
  type: 'file' as const,
  filename: 'test.txt',
  mime_type: 'text/plain',
  size_bytes: 1024,
  created_at: '2026-01-01T00:00:00Z',
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResp(status = 204): Response {
  return new Response(null, { status });
}

type Handlers = Record<string, () => Response>;

function makeFakeFetch(handlers: Handlers): Fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

    const entry = Object.entries(handlers).find(([k]) => url.includes(k));
    if (!entry) throw new Error(`unhandled URL: ${url}`);
    return entry[1]();
  };
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
    return jsonResp(FILE_FIXTURE);
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
// 1. upload()
// ---------------------------------------------------------------------------

// The multipart helper probes the fetch function with a `data:,` request to
// check FormData support. We filter those out to get only real API calls.
function apiCalls(calls: CapturedCall[]): CapturedCall[] {
  return calls.filter((c) => !c.url.startsWith('data:'));
}

describe('Files.upload()', () => {
  it('sends POST to /v1/files with FormData body', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['hello'], 'hi.txt', { type: 'text/plain' });
    await orca.files.upload({ file });

    const real = apiCalls(calls);
    expect(real).toHaveLength(1);
    const call = real[0]!;
    expect(call.url).toContain('/v1/files');
    expect(call.init?.method?.toUpperCase()).toBe('POST');
    // Body must be FormData (multipart)
    expect(call.init?.body).toBeInstanceOf(FormData);
  });

  it('includes the file under the "file" key in FormData', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['hello'], 'hi.txt', { type: 'text/plain' });
    await orca.files.upload({ file });

    const real = apiCalls(calls);
    const body = real[0]!.init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const entry = body.get('file');
    expect(entry).toBeInstanceOf(File);
    expect((entry as File).name).toBe('hi.txt');
  });

  it('uses the uploaded file MIME type without an extra multipart field', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    await orca.files.upload({ file });

    const real = apiCalls(calls);
    const body = real[0]!.init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).type).toBe('application/pdf');
    expect(body.get('content_type')).toBeNull();
  });

});

// ---------------------------------------------------------------------------
// 2. retrieve()
// ---------------------------------------------------------------------------

describe('Files.retrieve()', () => {
  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient();
    await orca.files.retrieve('file_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/files/file_abc123');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });
});

// ---------------------------------------------------------------------------
// 3. download()
// ---------------------------------------------------------------------------

describe('Files.download()', () => {
  it('sends GET to the content URL and returns the raw response', async () => {
    const { orca, calls } = makeClient(async () => {
      return new Response('hello file', {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      });
    });

    const response = await orca.files.download('file_abc123');

    expect(calls[0]!.url).toContain('/v1/files/file_abc123/content');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
    expect((calls[0]!.init?.headers as Headers).get('Accept')).toBe('application/octet-stream');
    expect(response).toBeInstanceOf(Response);
    expect(await response.text()).toBe('hello file');
  });

  it('preserves Headers request options while setting the binary Accept header', async () => {
    const { orca, calls } = makeClient(async () => {
      return new Response('hello file', {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      });
    });

    await orca.files.download('file_abc123', {
      headers: new Headers({ 'X-Test-Header': 'download' }),
    });

    const headers = calls[0]!.init?.headers as Headers;
    expect(headers.get('Accept')).toBe('application/octet-stream');
    expect(headers.get('X-Test-Header')).toBe('download');
  });
});

// ---------------------------------------------------------------------------
// 4. list()
// ---------------------------------------------------------------------------

describe('Files.list()', () => {
  const pageBody = {
    data: [FILE_FIXTURE],
    has_more: false,
    first_id: FILE_FIXTURE.id,
    last_id: FILE_FIXTURE.id,
  };

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(makeFakeFetch({ '/v1/files': () => jsonResp(pageBody) }));
    const page = await orca.files.list();
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.id).toBe(FILE_FIXTURE.id);
  });

  it('forwards ID cursors as query params', async () => {
    const { orca, calls } = makeClient(makeFakeFetch({ '/v1/files': () => jsonResp(pageBody) }));
    await orca.files.list({
      limit: 10,
      after_id: 'file_after',
      before_id: 'file_before',
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=10');
    expect(url).toContain('after_id=file_after');
    expect(url).toContain('before_id=file_before');
  });

  it('supports async iteration over paged results', async () => {
    const page1 = {
      data: [{ ...FILE_FIXTURE, id: 'file_1' }],
      has_more: true,
      last_id: 'file_1',
    };
    const page2 = {
      data: [{ ...FILE_FIXTURE, id: 'file_2' }],
      has_more: false,
      last_id: 'file_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca, calls } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const file of orca.files.list()) {
      ids.push(file.id);
    }

    expect(ids).toEqual(['file_1', 'file_2']);
    expect(callCount).toBe(2);
    expect(new URL(calls[1]!.url).searchParams.get('after_id')).toBe('file_1');
  });

  it('keeps before_id direction while iterating paged results', async () => {
    const page1 = {
      data: [{ ...FILE_FIXTURE, id: 'file_3' }],
      has_more: true,
      first_id: 'file_3',
      last_id: 'file_3',
    };
    const page2 = {
      data: [{ ...FILE_FIXTURE, id: 'file_4' }],
      has_more: false,
      first_id: 'file_4',
      last_id: 'file_4',
    };

    let callCount = 0;
    const { orca, calls } = makeClient(async () =>
      jsonResp(++callCount === 1 ? page1 : page2),
    );
    const ids: string[] = [];
    for await (const file of orca.files.list({ before_id: 'file_2' })) ids.push(file.id);

    expect(ids).toEqual(['file_3', 'file_4']);
    const nextQuery = new URL(calls[1]!.url).searchParams;
    expect(nextQuery.get('before_id')).toBe('file_3');
    expect(nextQuery.has('after_id')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. delete()
// ---------------------------------------------------------------------------

describe('Files.delete()', () => {
  it('sends DELETE to the correct URL and returns a tombstone', async () => {
    const tombstone = { id: 'file_abc123', type: 'file_deleted' as const };
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/files/': () => jsonResp(tombstone) }),
    );
    const result = await orca.files.delete('file_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/files/file_abc123');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(result).toEqual(tombstone);
  });
});

// ---------------------------------------------------------------------------
// 5. URL encoding
// ---------------------------------------------------------------------------

describe('URL encoding', () => {
  it('encodes fileId with special characters in retrieve', async () => {
    const { orca, calls } = makeClient();
    await orca.files.retrieve('file/with/slash');

    expect(calls[0]!.url).toContain('file%2Fwith%2Fslash');
    expect(calls[0]!.url).not.toContain('/file/with/slash');
  });

  it('encodes fileId with special characters in delete', async () => {
    const { orca, calls } = makeClient(makeFakeFetch({ '/v1/files/': () => emptyResp(204) }));
    await orca.files.delete('file/slash');

    expect(calls[0]!.url).toContain('file%2Fslash');
  });
});
