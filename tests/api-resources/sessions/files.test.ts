// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Sessions Files sub-resource.
 *
 * Both supported backends implement the canonical session-scoped file
 * operations from the managed-agents contract.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_FILE_FIXTURE = {
  id: 'file_abc',
  filename: 'report.pdf',
  mime_type: 'application/pdf',
  size_bytes: 10,
  created_at: '2026-01-01T00:00:00Z',
};

const DELETED_SESSION_FILE_FIXTURE = { id: 'file_abc', type: 'file_deleted' as const };

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function binaryResp(body = 'file-bytes'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/octet-stream' },
  });
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
    return jsonResp(SESSION_FILE_FIXTURE);
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

describe('SessionFiles.list()', () => {
  const pageBody = {
    data: [SESSION_FILE_FIXTURE],
    has_more: false,
    first_id: SESSION_FILE_FIXTURE.id,
    last_id: SESSION_FILE_FIXTURE.id,
  };

  it('sends GET to the canonical session files collection', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/sessions/session_xyz/files': () => jsonResp(pageBody) }),
    );
    await orca.sessions.files.list('session_xyz');

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/sessions/session_xyz/files');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(
      makeFakeFetch({ '/v1/sessions/session_xyz/files': () => jsonResp(pageBody) }),
    );
    const page = await orca.sessions.files.list('session_xyz');

    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.id).toBe(SESSION_FILE_FIXTURE.id);
  });

  it('forwards the ID-cursor query parameters', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/sessions/session_xyz/files': () => jsonResp(pageBody) }),
    );
    await orca.sessions.files.list('session_xyz', {
      limit: 10,
      after_id: 'file_after',
      before_id: 'file_before',
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=10');
    expect(url).toContain('after_id=file_after');
    expect(url).toContain('before_id=file_before');
  });

  it('uses last_id as after_id while iterating ID-cursor pages', async () => {
    const page1 = {
      data: [{ ...SESSION_FILE_FIXTURE, id: 'file_1' }],
      has_more: true,
      first_id: 'file_1',
      last_id: 'file_1',
    };
    const page2 = {
      data: [{ ...SESSION_FILE_FIXTURE, id: 'file_2' }],
      has_more: false,
      first_id: 'file_2',
      last_id: 'file_2',
    };
    let callCount = 0;
    const { orca, calls } = makeClient(async () => jsonResp(++callCount === 1 ? page1 : page2));

    const ids: string[] = [];
    for await (const file of orca.sessions.files.list('session_xyz')) ids.push(file.id);

    expect(ids).toEqual(['file_1', 'file_2']);
    expect(new URL(calls[1]!.url).searchParams.get('after_id')).toBe('file_1');
  });

  it('keeps before_id direction while iterating ID-cursor pages', async () => {
    const page1 = {
      data: [{ ...SESSION_FILE_FIXTURE, id: 'file_3' }],
      has_more: true,
      first_id: 'file_3',
      last_id: 'file_3',
    };
    const page2 = {
      data: [{ ...SESSION_FILE_FIXTURE, id: 'file_4' }],
      has_more: false,
      first_id: 'file_4',
      last_id: 'file_4',
    };
    let callCount = 0;
    const { orca, calls } = makeClient(async () =>
      jsonResp(++callCount === 1 ? page1 : page2),
    );

    const ids: string[] = [];
    for await (const file of orca.sessions.files.list('session_xyz', { before_id: 'file_2' })) {
      ids.push(file.id);
    }

    expect(ids).toEqual(['file_3', 'file_4']);
    const nextQuery = new URL(calls[1]!.url).searchParams;
    expect(nextQuery.get('before_id')).toBe('file_3');
    expect(nextQuery.has('after_id')).toBe(false);
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/sessions/session_xyz/files': () => jsonResp(pageBody) }),
    );
    await orca.sessions.files.list('session_xyz', {}, { headers: { 'X-Test': 'list' } });

    expect((calls[0]!.init?.headers as Headers).get('x-test')).toBe('list');
  });
});

// ---------------------------------------------------------------------------
// 2. retrieve()
// ---------------------------------------------------------------------------

describe('SessionFiles.retrieve()', () => {
  it('sends GET to the session-scoped file URL', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.files.retrieve('session_xyz', 'file_abc');

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/sessions/session_xyz/files/file_abc');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('URL-encodes sessionId and fileId', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.files.retrieve('session/slash', 'file/slash');

    expect(calls[0]!.url).toContain('/v1/sessions/session%2Fslash/files/file%2Fslash');
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.files.retrieve('session_xyz', 'file_abc', {
      headers: { 'X-Test': 'retrieve' },
    });

    expect((calls[0]!.init?.headers as Headers).get('x-test')).toBe('retrieve');
  });
});

// ---------------------------------------------------------------------------
// 3. download()
// ---------------------------------------------------------------------------

describe('SessionFiles.download()', () => {
  it('returns the raw response from the session-scoped content URL', async () => {
    const { orca, calls } = makeClient(async () => binaryResp('hello'));
    const response = await orca.sessions.files.download('session_xyz', 'file_abc');

    expect(response).toBeInstanceOf(Response);
    expect(await response.text()).toBe('hello');
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/sessions/session_xyz/files/file_abc/content');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
    expect((calls[0]!.init?.headers as Headers).get('accept')).toBe('application/octet-stream');
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient(async () => binaryResp());
    await orca.sessions.files.download('session_xyz', 'file_abc', {
      headers: { 'X-Test': 'download' },
    });

    expect((calls[0]!.init?.headers as Headers).get('x-test')).toBe('download');
  });
});

// ---------------------------------------------------------------------------
// 4. delete()
// ---------------------------------------------------------------------------

describe('SessionFiles.delete()', () => {
  it('sends DELETE to the session-scoped file URL and returns the tombstone', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(DELETED_SESSION_FILE_FIXTURE));
    const deleted = await orca.sessions.files.delete('session_xyz', 'file_abc');

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/sessions/session_xyz/files/file_abc');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(deleted).toEqual(DELETED_SESSION_FILE_FIXTURE);
  });

  it('passes request options through', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(DELETED_SESSION_FILE_FIXTURE));
    await orca.sessions.files.delete('session_xyz', 'file_abc', {
      headers: { 'X-Test': 'delete' },
    });

    expect((calls[0]!.init?.headers as Headers).get('x-test')).toBe('delete');
  });
});

// ---------------------------------------------------------------------------
// 5. Uses the shared canonical paths on both supported backends
// ---------------------------------------------------------------------------

describe('SessionFiles portability', () => {
  it('every operation stays under /v1/sessions — no legacy or extension prefix', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({
        '/v1/sessions/session_xyz/files/file_abc/content': () => binaryResp(),
        '/v1/sessions/session_xyz/files/file_abc': () => jsonResp(SESSION_FILE_FIXTURE),
        '/v1/sessions/session_xyz/files': () => jsonResp({ data: [], has_more: false }),
      }),
    );

    await orca.sessions.files.list('session_xyz');
    await orca.sessions.files.retrieve('session_xyz', 'file_abc');
    await orca.sessions.files.download('session_xyz', 'file_abc');
    await orca.sessions.files.delete('session_xyz', 'file_abc');

    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(new URL(call.url).pathname).toContain('/v1/sessions/session_xyz/files');
      expect(call.url).not.toContain('/v1/registry');
      expect(call.url).not.toContain('/apis/');
    }
  });
});
