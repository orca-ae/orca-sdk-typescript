// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { PageCursor, PageCursorResponse, PagePromise } from '../../src/core/pagination';
import type { APIResponseProps } from '../../src/internal/parse';
import type { FinalRequestOptions } from '../../src/internal/request-options';
import { Orca } from '../../src/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_OPTIONS: FinalRequestOptions = { method: 'get', path: '/v1/agents' };

function makeClient(overrides: Record<string, any> = {}): Orca {
  const client = new Orca({ apiKey: 'test-key', baseURL: 'https://api.example.com' });
  return Object.assign(client, overrides);
}

/** Build a fake APIResponseProps whose .response holds a JSON PageCursorResponse. */
function makeResponseProps<T>(body: PageCursorResponse<T>, status = 200): APIResponseProps {
  const json = JSON.stringify(body);
  const response = new Response(json, {
    status,
    headers: { 'content-type': 'application/json' },
  });
  return {
    response,
    options: BASE_OPTIONS,
    controller: new AbortController(),
    requestLogID: 'log_test',
    retryOfRequestLogID: undefined,
    startTime: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// 1. Basic PageCursor construction and single-page iteration
// ---------------------------------------------------------------------------

describe('PageCursor — basic', () => {
  const body: PageCursorResponse<{ id: string }> = {
    data: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
    has_more: false,
    first_id: 'a1',
    last_id: 'a3',
  };

  it('getPaginatedItems() returns the data array', () => {
    const client = makeClient();
    const page = new PageCursor(client, body, BASE_OPTIONS);
    expect(page.getPaginatedItems()).toEqual(body.data);
  });

  it('hasNextPage() is false when has_more is false', () => {
    const page = new PageCursor(makeClient(), body, BASE_OPTIONS);
    expect(page.hasNextPage()).toBe(false);
  });

  it('hasNextPage() is false when has_more is true but neither cursor is present', () => {
    const b: PageCursorResponse<string> = {
      data: ['x'],
      has_more: true,
      // no next_page
    };
    const page = new PageCursor(makeClient(), b, BASE_OPTIONS);
    expect(page.hasNextPage()).toBe(false);
  });

  it('hasNextPage() is true when has_more && next_page both set', () => {
    const b: PageCursorResponse<string> = {
      data: ['x'],
      has_more: true,
      next_page: 'cursor-abc',
    };
    const page = new PageCursor(makeClient(), b, BASE_OPTIONS);
    expect(page.hasNextPage()).toBe(true);
  });

  it('hasNextPage() is true when an opaque next_page is present without has_more', () => {
    const page = new PageCursor(
      makeClient(),
      {
        data: ['x'],
        next_page: 'cursor-abc',
      },
      BASE_OPTIONS,
    );
    expect(page.hasNextPage()).toBe(true);
  });

  it('hasNextPage() is true for ID-cursor responses with has_more and last_id', () => {
    const page = new PageCursor(
      makeClient(),
      {
        data: ['x'],
        has_more: true,
        last_id: 'file_abc',
      },
      BASE_OPTIONS,
    );
    expect(page.hasNextPage()).toBe(true);
  });

  it('uses first_id to detect another page in before_id direction', () => {
    const page = new PageCursor(
      makeClient(),
      {
        data: ['x'],
        has_more: true,
        first_id: 'file_first',
      },
      { ...BASE_OPTIONS, query: { before_id: 'file_anchor' } },
    );
    expect(page.hasNextPage()).toBe(true);
  });

  it('async iteration over a single-page cursor yields all items without getNextPage', async () => {
    const page = new PageCursor(makeClient(), body, BASE_OPTIONS);
    const collected: { id: string }[] = [];
    for await (const item of page) {
      collected.push(item);
    }
    expect(collected).toEqual(body.data);
  });
});

// ---------------------------------------------------------------------------
// 2. Multi-page async iteration using a stub client
// ---------------------------------------------------------------------------

describe('PageCursor — multi-page iteration', () => {
  it('yields items from page 1 then page 2, then terminates', async () => {
    const page1Body: PageCursorResponse<string> = {
      data: ['item-1', 'item-2'],
      has_more: true,
      first_id: 'item-1',
      last_id: 'item-2',
      next_page: 'cursor-p2',
    };

    const page2Body: PageCursorResponse<string> = {
      data: ['item-3', 'item-4'],
      has_more: false,
      first_id: 'item-3',
      last_id: 'item-4',
    };

    let requestAPIListCalls = 0;

    // Stub client whose requestAPIList returns page 2.
    const client = makeClient({
      requestAPIList: async (_PageClass: any, opts: FinalRequestOptions) => {
        requestAPIListCalls++;
        return new PageCursor<string>(client, page2Body, opts);
      },
    });

    const page1 = new PageCursor<string>(client, page1Body, BASE_OPTIONS);
    const collected: string[] = [];
    for await (const item of page1) {
      collected.push(item);
    }

    expect(collected).toEqual(['item-1', 'item-2', 'item-3', 'item-4']);
    expect(requestAPIListCalls).toBe(1); // only one next-page fetch
  });

  it('getNextPage() passes the cursor in query params', async () => {
    let capturedOptions: FinalRequestOptions | undefined;

    const page2Body: PageCursorResponse<string> = {
      data: ['item-3'],
      has_more: false,
    };

    const client = makeClient({
      requestAPIList: async (_PageClass: any, opts: FinalRequestOptions) => {
        capturedOptions = opts;
        return new PageCursor<string>(client, page2Body, opts);
      },
    });

    const page1Body: PageCursorResponse<string> = {
      data: ['item-1'],
      has_more: true,
      next_page: 'cursor-xyz',
    };

    const page1 = new PageCursor<string>(client, page1Body, BASE_OPTIONS);
    await page1.getNextPage();

    expect((capturedOptions?.query as any)?.page).toBe('cursor-xyz');
  });

  it('getNextPage() passes last_id as after_id for ID-cursor endpoints', async () => {
    let capturedOptions: FinalRequestOptions | undefined;

    const client = makeClient({
      requestAPIList: async (_PageClass: any, opts: FinalRequestOptions) => {
        capturedOptions = opts;
        return new PageCursor<string>(client, { data: [], has_more: false }, opts);
      },
    });

    const page = new PageCursor<string>(
      client,
      { data: ['file_1'], has_more: true, last_id: 'file_1' },
      { ...BASE_OPTIONS, query: { limit: 10 } },
    );
    await page.getNextPage();

    expect(capturedOptions?.query).toEqual({ limit: 10, after_id: 'file_1' });
  });

  it('getNextPage() preserves before_id direction with first_id only', async () => {
    let capturedOptions: FinalRequestOptions | undefined;

    const client = makeClient({
      requestAPIList: async (_PageClass: any, opts: FinalRequestOptions) => {
        capturedOptions = opts;
        return new PageCursor<string>(client, { data: [], has_more: false }, opts);
      },
    });

    const page = new PageCursor<string>(
      client,
      {
        data: ['file_3', 'file_2'],
        has_more: true,
        first_id: 'file_3',
        last_id: 'file_2',
      },
      { ...BASE_OPTIONS, query: { limit: 10, before_id: 'file_1' } },
    );
    await page.getNextPage();

    expect(capturedOptions?.query).toEqual({ limit: 10, before_id: 'file_3' });
  });
});

// ---------------------------------------------------------------------------
// 3. getNextPage() error cases
// ---------------------------------------------------------------------------

describe('PageCursor — getNextPage() errors', () => {
  it('throws when there are no more pages', async () => {
    const body: PageCursorResponse<string> = { data: [], has_more: false };
    const page = new PageCursor(makeClient(), body, BASE_OPTIONS);
    await expect(page.getNextPage()).rejects.toThrow('No more pages to fetch');
  });

  it('delegates to the client request pipeline for next-page fetches', async () => {
    const page2Body: PageCursorResponse<string> = { data: ['next'], has_more: false };
    let pipelineCalls = 0;

    const client = makeClient({
      requestAPIList: (_PageClass: any, opts: FinalRequestOptions) => {
        pipelineCalls++;
        // Construct a PagePromise from a pre-resolved response so we don't
        // hit any real network during the test.
        const props: APIResponseProps = {
          response: new Response(JSON.stringify(page2Body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
          options: opts,
          controller: new AbortController(),
          requestLogID: 'log_test',
          retryOfRequestLogID: undefined,
          startTime: Date.now(),
        };
        return new PagePromise<PageCursor<string>, string>(client, Promise.resolve(props), PageCursor);
      },
    });

    const page1Body: PageCursorResponse<string> = {
      data: ['x'],
      has_more: true,
      next_page: 'cursor-abc',
    };
    const page = new PageCursor<string>(client, page1Body, BASE_OPTIONS);
    const next = await page.getNextPage();

    expect(pipelineCalls).toBe(1);
    expect(next.getPaginatedItems()).toEqual(['next']);
  });
});

// ---------------------------------------------------------------------------
// 4. PagePromise — awaitable and iterable
// ---------------------------------------------------------------------------

describe('PagePromise', () => {
  it('resolves to a PageCursor instance', async () => {
    const body: PageCursorResponse<string> = {
      data: ['alpha', 'beta'],
      has_more: false,
    };
    const props = makeResponseProps(body);
    const client = makeClient();
    const pp = new PagePromise<PageCursor<string>, string>(client, Promise.resolve(props), PageCursor);

    const page = await pp;
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.getPaginatedItems()).toEqual(['alpha', 'beta']);
  });

  it('supports async iteration directly (yields items from the resolved page)', async () => {
    const body: PageCursorResponse<number> = {
      data: [10, 20, 30],
      has_more: false,
    };
    const props = makeResponseProps(body);
    const client = makeClient();
    const pp = new PagePromise<PageCursor<number>, number>(client, Promise.resolve(props), PageCursor);

    const collected: number[] = [];
    for await (const item of pp) {
      collected.push(item);
    }
    expect(collected).toEqual([10, 20, 30]);
  });

  it('hasNextPage() on the resolved page is false when has_more is false', async () => {
    const body: PageCursorResponse<string> = {
      data: ['only-item'],
      has_more: false,
    };
    const props = makeResponseProps(body);
    const client = makeClient();
    const pp = new PagePromise<PageCursor<string>, string>(client, Promise.resolve(props), PageCursor);

    const page = await pp;
    expect(page.hasNextPage()).toBe(false);
  });

  it('propagates errors from the response promise', async () => {
    const client = makeClient();
    const pp = new PagePromise<PageCursor<string>, string>(
      client,
      Promise.reject(new Error('request failed')),
      PageCursor,
    );
    await expect(pp).rejects.toThrow('request failed');
  });
});
