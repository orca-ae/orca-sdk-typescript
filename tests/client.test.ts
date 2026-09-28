// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for `BaseOrca` / `Orca` — the request pipeline keystone.
 *
 * Strategy: inject a fake `fetch` so tests stay hermetic. The fake
 * captures every call and returns canned responses; assertions inspect
 * the captured requests for headers, URL shape, method, and body.
 */

import { Orca, type OrcaOptions } from '../src/client';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  ExtensionNotAvailableError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
} from '../src/core/error';
import { PageCursor, type PageCursorResponse } from '../src/core/pagination';
import type { RequestInfo, RequestInit } from '../src/internal/builtin-types';
import { VERSION } from '../src/version';

// ---------------------------------------------------------------------------
// Fake fetch helpers
// ---------------------------------------------------------------------------

type CapturedCall = { url: string; init: RequestInit };

type FakeFetch = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    ...init,
  });
}

function emptyResponse(status = 204, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

/**
 * Build an `Orca` client wired to a fake fetch and capture every call it
 * sees. The fake returns responses from `queue` in order; if the queue is
 * empty it returns a 200 with the body `{ ok: true }`.
 */
function makeOrca(
  queue: Response[] = [],
  options: Partial<OrcaOptions> = {},
): { orca: Orca; calls: CapturedCall[]; fakeFetch: FakeFetch } {
  const calls: CapturedCall[] = [];
  const fakeFetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = queue.shift();
    return next ?? jsonResponse({ ok: true });
  }) as unknown as FakeFetch;

  const orca = new Orca({
    apiKey: 'test-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: fakeFetch as unknown as typeof fetch,
    ...options,
  });

  return { orca, calls, fakeFetch };
}

function headersOf(call: CapturedCall): Record<string, string> {
  const h = call.init.headers;
  if (!h) return {};
  if (h instanceof Headers) {
    const out: Record<string, string> = {};
    h.forEach((value, name) => {
      out[name.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(h)) {
    return Object.fromEntries(h.map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  }
  return Object.fromEntries(
    Object.entries(h as Record<string, string>).map(([k, v]) => [k.toLowerCase(), String(v)]),
  );
}

// ---------------------------------------------------------------------------
// 1. Constructor / baseURL / apiKey resolution
// ---------------------------------------------------------------------------

describe('Orca constructor', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses an explicit baseURL and strips trailing slashes', () => {
    const orca = new Orca({ apiKey: 'k', baseURL: 'https://api.example.test///' });
    expect(orca.baseURL).toBe('https://api.example.test');
  });

  it('falls back to ORCA_BASE_URL when option omitted', () => {
    process.env['ORCA_BASE_URL'] = 'https://env.example.test';
    const orca = new Orca({ apiKey: 'k' });
    expect(orca.baseURL).toBe('https://env.example.test');
  });

  it('throws when no baseURL is provided anywhere', () => {
    delete process.env['ORCA_BASE_URL'];
    expect(() => new Orca({ apiKey: 'k' })).toThrow(/baseURL is required/);
  });

  it('falls back to ORCA_API_KEY when apiKey option omitted', () => {
    process.env['ORCA_API_KEY'] = 'env-key';
    const orca = new Orca({ baseURL: 'https://api.example.test' });
    expect(orca.apiKey).toBe('env-key');
  });

  it('explicit null apiKey disables auth', () => {
    process.env['ORCA_API_KEY'] = 'env-key';
    const orca = new Orca({ apiKey: null, baseURL: 'https://api.example.test' });
    expect(orca.apiKey).toBeNull();
  });

  it('defaults maxRetries to 2 and timeout to 10 minutes', () => {
    const orca = new Orca({ apiKey: 'k', baseURL: 'https://api.example.test' });
    expect(orca.maxRetries).toBe(2);
    expect(orca.timeout).toBe(10 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// 2. Auth header behavior
// ---------------------------------------------------------------------------

describe('auth header', () => {
  it('attaches Authorization: Bearer <apiKey> when apiKey is a string', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('/v1/agents');
    expect(headersOf(calls[0]!)['authorization']).toBe('Bearer test-key');
  });

  it('invokes apiKey function per request and uses its return value', async () => {
    let invocations = 0;
    const apiKey = jest.fn(async () => {
      invocations++;
      return `rotating-${invocations}`;
    });
    const { orca, calls } = makeOrca([], { apiKey });

    await orca.get('/v1/agents');
    await orca.get('/v1/agents');

    expect(apiKey).toHaveBeenCalledTimes(2);
    expect(headersOf(calls[0]!)['authorization']).toBe('Bearer rotating-1');
    expect(headersOf(calls[1]!)['authorization']).toBe('Bearer rotating-2');
  });

  it('omits Authorization when apiKey is null', async () => {
    const { orca, calls } = makeOrca([], { apiKey: null });
    await orca.get('/v1/agents');
    expect(headersOf(calls[0]!)['authorization']).toBeUndefined();
  });

  it('throws when apiKey function returns empty string', async () => {
    const { orca } = makeOrca([], { apiKey: async () => '' });
    await expect(orca.get('/v1/agents')).rejects.toThrow(/must return a non-empty string/);
  });
});

// ---------------------------------------------------------------------------
// 3. Default headers (User-Agent, X-Orca-Client, Accept)
// ---------------------------------------------------------------------------

describe('default headers', () => {
  it('sets X-Orca-Client on every request', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('/v1/agents');
    expect(headersOf(calls[0]!)['x-orca-client']).toBe(`orca-sdk-ts/${VERSION}`);
  });

  it('sets User-Agent', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('/v1/agents');
    expect(headersOf(calls[0]!)['user-agent']).toBe(`Orca/JS ${VERSION}`);
  });

  it('sets Accept: application/json by default', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('/v1/agents');
    expect(headersOf(calls[0]!)['accept']).toBe('application/json');
  });

  it('sets Accept: text/event-stream for streaming requests', async () => {
    // SSE endpoints content-negotiate strictly and 406 on application/json;
    // stream: true must flip Accept to the event-stream media type.
    const { orca, calls } = makeOrca();
    await orca.get('/v1/sessions/s1/events/stream', { stream: true });
    expect(headersOf(calls[0]!)['accept']).toBe('text/event-stream');
  });

  it('merges constructor-level defaultHeaders into every request', async () => {
    const { orca, calls } = makeOrca([], {
      defaultHeaders: { 'X-Tenant-Id': 'tenant-42' },
    });
    await orca.get('/v1/agents');
    expect(headersOf(calls[0]!)['x-tenant-id']).toBe('tenant-42');
  });

  it('per-request headers win over defaults', async () => {
    const { orca, calls } = makeOrca([], { defaultHeaders: { 'X-Tenant-Id': 'default' } });
    await orca.get('/v1/agents', { headers: { 'X-Tenant-Id': 'override' } });
    expect(headersOf(calls[0]!)['x-tenant-id']).toBe('override');
  });
});

// ---------------------------------------------------------------------------
// 4. HTTP verb wrappers
// ---------------------------------------------------------------------------

describe('HTTP method wrappers', () => {
  it('get uses GET', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('/v1/agents');
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('post sends JSON-encoded body', async () => {
    const { orca, calls } = makeOrca();
    await orca.post('/v1/agents', { body: { name: 'agent-1' } });
    const call = calls[0]!;
    expect(call.init.method).toBe('POST');
    expect(call.init.body).toBe(JSON.stringify({ name: 'agent-1' }));
    expect(headersOf(call)['content-type']).toBe('application/json');
  });

  it('put / patch / delete route correctly', async () => {
    const { orca, calls } = makeOrca([
      jsonResponse({ ok: true }),
      jsonResponse({ ok: true }),
      jsonResponse({ ok: true }),
    ]);
    await orca.put('/v1/agents/a1', { body: { description: 'x' } });
    await orca.patch('/v1/agents/a1', { body: { description: 'y' } });
    await orca.delete('/v1/agents/a1');
    expect(calls[0]!.init.method).toBe('PUT');
    expect(calls[1]!.init.method).toBe('PATCH');
    expect(calls[2]!.init.method).toBe('DELETE');
  });

  it('merges query parameters into URL', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('/v1/agents', { query: { limit: 25, archived: 'false' } });
    expect(calls[0]!.url).toContain('limit=25');
    expect(calls[0]!.url).toContain('archived=false');
  });
});

// ---------------------------------------------------------------------------
// 5. Retry behaviour
// ---------------------------------------------------------------------------

describe('retries', () => {
  it('retries on 500 up to maxRetries then surfaces InternalServerError', async () => {
    const responses = [
      jsonResponse({ error: 'boom' }, { status: 500 }),
      jsonResponse({ error: 'boom' }, { status: 500 }),
      jsonResponse({ error: 'boom' }, { status: 500 }),
    ];
    const { orca, fakeFetch } = makeOrca(responses, { maxRetries: 2 });
    await expect(orca.get('/v1/agents')).rejects.toBeInstanceOf(InternalServerError);
    expect(fakeFetch).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('does NOT retry 401', async () => {
    const { orca, fakeFetch } = makeOrca([jsonResponse({}, { status: 401 })], { maxRetries: 3 });
    await expect(orca.get('/v1/agents')).rejects.toBeInstanceOf(AuthenticationError);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry 400', async () => {
    const { orca, fakeFetch } = makeOrca([jsonResponse({}, { status: 400 })], { maxRetries: 3 });
    await expect(orca.get('/v1/agents')).rejects.toBeInstanceOf(BadRequestError);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('retries 429 honoring Retry-After header (ms)', async () => {
    const responses = [
      jsonResponse({}, { status: 429, headers: { 'retry-after-ms': '5' } }),
      jsonResponse({ ok: true }),
    ];
    const { orca, fakeFetch } = makeOrca(responses, { maxRetries: 1 });
    const result = (await orca.get<{ ok: boolean }>('/v1/agents')) as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it('429 final failure surfaces RateLimitError', async () => {
    const { orca } = makeOrca([jsonResponse({}, { status: 429, headers: { 'retry-after-ms': '0' } })], {
      maxRetries: 0,
    });
    await expect(orca.get('/v1/agents')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('honors x-should-retry: false override', async () => {
    const { orca, fakeFetch } = makeOrca(
      [jsonResponse({}, { status: 500, headers: { 'x-should-retry': 'false' } })],
      { maxRetries: 3 },
    );
    await expect(orca.get('/v1/agents')).rejects.toBeInstanceOf(InternalServerError);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('honors x-should-retry: true override on 400', async () => {
    const responses = [
      jsonResponse({}, { status: 400, headers: { 'x-should-retry': 'true', 'retry-after-ms': '0' } }),
      jsonResponse({ ok: true }),
    ];
    const { orca, fakeFetch } = makeOrca(responses, { maxRetries: 1 });
    await orca.get('/v1/agents');
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Error mapping
// ---------------------------------------------------------------------------

describe('error mapping', () => {
  it('404 → NotFoundError', async () => {
    const { orca } = makeOrca([jsonResponse({ error: { type: 'not_found' } }, { status: 404 })]);
    await expect(orca.get('/v1/agents/a1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('network failure → APIConnectionError', async () => {
    const { orca } = makeOrca([], {
      maxRetries: 0,
      fetch: (async () => {
        throw new Error('socket hang up');
      }) as unknown as typeof fetch,
    });
    await expect(orca.get('/v1/agents')).rejects.toBeInstanceOf(APIConnectionError);
  });

  it('AbortError → APIConnectionTimeoutError', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const { orca } = makeOrca([], {
      maxRetries: 0,
      fetch: (async () => {
        throw abort;
      }) as unknown as typeof fetch,
    });
    await expect(orca.get('/v1/agents')).rejects.toBeInstanceOf(APIConnectionTimeoutError);
  });
});

// ---------------------------------------------------------------------------
// 7. 204 No Content and binary responses
// ---------------------------------------------------------------------------

describe('response parsing', () => {
  it('204 returns null', async () => {
    const { orca } = makeOrca([emptyResponse(204)]);
    const result = await orca.delete<null>('/v1/agents/a1');
    expect(result).toBeNull();
  });

  it('JSON content-type is decoded', async () => {
    const { orca } = makeOrca([jsonResponse({ id: 'agent-1', name: 'x' })]);
    const result = await orca.get<{ id: string }>('/v1/agents/a1');
    expect(result).toEqual({ id: 'agent-1', name: 'x' });
  });
});

// ---------------------------------------------------------------------------
// 8. URL building (defaultQuery, absolute paths)
// ---------------------------------------------------------------------------

describe('buildURL', () => {
  it('merges defaultQuery from client options', async () => {
    const { orca, calls } = makeOrca([], { defaultQuery: { workspace_id: 'ws-1' } });
    await orca.get('/v1/agents');
    expect(calls[0]!.url).toContain('workspace_id=ws-1');
  });

  it('per-request query overrides defaultQuery', async () => {
    const { orca, calls } = makeOrca([], { defaultQuery: { workspace_id: 'ws-1' } });
    await orca.get('/v1/agents', { query: { workspace_id: 'ws-2' } });
    expect(calls[0]!.url).toContain('workspace_id=ws-2');
    expect(calls[0]!.url).not.toContain('workspace_id=ws-1');
  });

  it('absolute path bypasses baseURL', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('https://other.example.test/health');
    expect(calls[0]!.url.startsWith('https://other.example.test/health')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. getAPIList / pagination wiring
// ---------------------------------------------------------------------------

describe('getAPIList', () => {
  it('returns a PagePromise that resolves to a PageCursor', async () => {
    const body: PageCursorResponse<{ id: string }> = {
      data: [{ id: 'a1' }, { id: 'a2' }],
      has_more: false,
    };
    const { orca } = makeOrca([jsonResponse(body)]);
    const page = await orca.getAPIList<{ id: string }>('/v1/agents', PageCursor);
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.getPaginatedItems()).toEqual(body.data);
  });

  it('async iteration walks pages via getNextPage', async () => {
    const page1: PageCursorResponse<string> = {
      data: ['one', 'two'],
      has_more: true,
      next_page: 'cursor-p2',
    };
    const page2: PageCursorResponse<string> = {
      data: ['three'],
      has_more: false,
    };
    const { orca, calls } = makeOrca([jsonResponse(page1), jsonResponse(page2)]);

    const collected: string[] = [];
    for await (const item of orca.getAPIList<string>('/v1/agents', PageCursor)) {
      collected.push(item);
    }
    expect(collected).toEqual(['one', 'two', 'three']);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url).toContain('page=cursor-p2');
  });
});

// ---------------------------------------------------------------------------
// 10. Idempotency key
// ---------------------------------------------------------------------------

describe('idempotency', () => {
  it('sets Idempotency-Key header when supplied', async () => {
    const { orca, calls } = makeOrca();
    await orca.post('/v1/agents', { body: { name: 'a' }, idempotencyKey: 'idem-123' });
    expect(headersOf(calls[0]!)['idempotency-key']).toBe('idem-123');
  });

  it('does not set Idempotency-Key on GET', async () => {
    const { orca, calls } = makeOrca();
    await orca.get('/v1/agents', { idempotencyKey: 'idem-123' });
    expect(headersOf(calls[0]!)['idempotency-key']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 11. AbortSignal propagation
// ---------------------------------------------------------------------------

describe('abort', () => {
  it('throws APIUserAbortError when signal is already aborted', async () => {
    const { orca } = makeOrca();
    const controller = new AbortController();
    controller.abort();
    await expect(orca.get('/v1/agents', { signal: controller.signal })).rejects.toThrow(
      /aborted/i,
    );
  });
});

// ---------------------------------------------------------------------------
// 12. Legacy baseURL shim
// ---------------------------------------------------------------------------
//
// Existing users pass a `baseURL` ending in `/v1/registry` or `/v1` — what
// used to be required. They must keep working, with a deprecation warning.

describe('legacy baseURL shim', () => {
  it('strips a /v1/registry suffix and still reaches {host}/v1/agents', async () => {
    const { orca, calls } = makeOrca([], { baseURL: 'https://host.example.test/v1/registry' });
    expect(orca.baseURL).toBe('https://host.example.test');

    await orca.get('/v1/agents');
    expect(calls[0]!.url).toBe('https://host.example.test/v1/agents');
  });

  it('strips a bare /v1 suffix and still reaches {host}/v1/agents', async () => {
    const { orca, calls } = makeOrca([], { baseURL: 'https://host.example.test/v1' });
    expect(orca.baseURL).toBe('https://host.example.test');

    await orca.get('/v1/agents');
    expect(calls[0]!.url).toBe('https://host.example.test/v1/agents');
  });

  it('logs a deprecation warning when the shim strips a suffix', () => {
    const warn = jest.fn();
    makeOrca([], {
      baseURL: 'https://host.example.test/v1/registry',
      logger: { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() },
      logLevel: 'warn',
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('/v1/registry');
  });

  it('does not warn or alter a baseURL with no legacy suffix', () => {
    const warn = jest.fn();
    const { orca } = makeOrca([], {
      baseURL: 'https://host.example.test',
      logger: { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() },
      logLevel: 'warn',
    });

    expect(orca.baseURL).toBe('https://host.example.test');
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not strip a baseURL that merely contains "v1" mid-path', () => {
    const { orca } = makeOrca([], { baseURL: 'https://host.example.test/v1/extra' });
    expect(orca.baseURL).toBe('https://host.example.test/v1/extra');
  });

  it('does not mistake a version-named hostname for a legacy path', async () => {
    const { orca, calls } = makeOrca([], { baseURL: 'http://v1' });
    expect(orca.baseURL).toBe('http://v1');

    await orca.get('/v1/agents');
    expect(calls[0]!.url).toBe('http://v1/v1/agents');
  });

  it('strips the whole "/api/v1" suffix, not just the trailing /v1', () => {
    // Stripping only `/v1` would leave `.../api`, where core paths still
    // resolve (`/api` + `/v1/agents` = `/api/v1/agents`, the documented
    // alias) but extension paths do not (`/api` + `/apis/cloud.sn.io/v1/...`
    // is not a route the server has). Stripping the whole `/api/v1` suffix
    // instead leaves the actual host root, where both resolve — strictly
    // better than leaving either `/v1` or the full suffix in place.
    const { orca } = makeOrca([], { baseURL: 'https://host.example.test/api/v1' });
    expect(orca.baseURL).toBe('https://host.example.test');
  });

  it('from a stripped "/api/v1" base, both a core and an extension path resolve', async () => {
    const { orca, calls } = makeOrca([], { baseURL: 'https://host.example.test/api/v1' });
    expect(orca.baseURL).toBe('https://host.example.test');

    await orca.get('/v1/agents');
    await orca.get('/apis/cloud.sn.io/v1/connections');

    expect(calls[0]!.url).toBe('https://host.example.test/v1/agents');
    expect(calls[1]!.url).toBe('https://host.example.test/apis/cloud.sn.io/v1/connections');
  });

  it('logs a deprecation warning naming the /api/v1 suffix specifically', () => {
    const warn = jest.fn();
    makeOrca([], {
      baseURL: 'https://host.example.test/api/v1',
      logger: { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() },
      logLevel: 'warn',
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('/api/v1');
  });
});

// ---------------------------------------------------------------------------
// 13. URL construction — core vs. extension paths
// ---------------------------------------------------------------------------
//
// From a baseURL with no path (the host root), a core path must resolve to
// exactly `{base}/v1/...` and an extension path to exactly
// `{base}/apis/cloud.sn.io/v1/...`. Asserted against literal strings, not
// against whatever constant the implementation happens to use.

describe('URL construction — core vs extension', () => {
  it('a core path resolves to {base}/v1/agents', async () => {
    const { orca, calls } = makeOrca([], { baseURL: 'https://workspace.example.com' });
    await orca.get('/v1/agents');
    expect(calls[0]!.url).toBe('https://workspace.example.com/v1/agents');
  });

  it('an extension path resolves to {base}/apis/cloud.sn.io/v1/connections', async () => {
    const { orca, calls } = makeOrca([], { baseURL: 'https://workspace.example.com' });
    await orca.get('/apis/cloud.sn.io/v1/connections');
    expect(calls[0]!.url).toBe(
      'https://workspace.example.com/apis/cloud.sn.io/v1/connections',
    );
  });
});

// ---------------------------------------------------------------------------
// 14. Extension discovery / gating (`ensureExtensionAvailable`)
// ---------------------------------------------------------------------------

describe('ensureExtensionAvailable', () => {
  it('resolves when GET /apis advertises the group', async () => {
    const { orca, fakeFetch } = makeOrca([
      jsonResponse({ kind: 'APIGroupList', groups: [{ name: 'cloud.sn.io', versions: [] }] }),
    ]);
    await expect(orca.ensureExtensionAvailable('cloud.sn.io')).resolves.toBeUndefined();
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('throws ExtensionNotAvailableError — not a surfaced 404 — when groups is empty', async () => {
    const { orca } = makeOrca([jsonResponse({ kind: 'APIGroupList', groups: [] })]);
    const err = await orca.ensureExtensionAvailable('cloud.sn.io').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExtensionNotAvailableError);
    expect((err as ExtensionNotAvailableError).group).toBe('cloud.sn.io');
  });

  it('throws ExtensionNotAvailableError when groups exist but do not include the target', async () => {
    const { orca } = makeOrca([
      jsonResponse({ kind: 'APIGroupList', groups: [{ name: 'some.other.group', versions: [] }] }),
    ]);
    await expect(orca.ensureExtensionAvailable('cloud.sn.io')).rejects.toBeInstanceOf(
      ExtensionNotAvailableError,
    );
  });

  it('throws ExtensionNotAvailableError — not NotFoundError — when /apis itself 404s', async () => {
    const { orca } = makeOrca([jsonResponse({}, { status: 404 })]);
    const err = await orca.ensureExtensionAvailable('cloud.sn.io').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExtensionNotAvailableError);
    expect(err).not.toBeInstanceOf(NotFoundError);
  });

  it('logs a version warning when /apis 404s (pre-discovery deployment)', async () => {
    const warn = jest.fn();
    const { orca } = makeOrca([jsonResponse({}, { status: 404 })], {
      logger: { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() },
      logLevel: 'warn',
    });
    await orca.ensureExtensionAvailable('cloud.sn.io').catch(() => {});
    expect(warn).toHaveBeenCalled();
  });

  it('does not warn when /apis returns 200 with an empty groups array', async () => {
    const warn = jest.fn();
    const { orca } = makeOrca([jsonResponse({ kind: 'APIGroupList', groups: [] })], {
      logger: { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() },
      logLevel: 'warn',
    });
    await orca.ensureExtensionAvailable('cloud.sn.io').catch(() => {});
    expect(warn).not.toHaveBeenCalled();
  });

  it('caches a successful discovery result across repeated calls', async () => {
    const { orca, fakeFetch } = makeOrca([
      jsonResponse({ kind: 'APIGroupList', groups: [{ name: 'cloud.sn.io', versions: [] }] }),
    ]);
    await orca.ensureExtensionAvailable('cloud.sn.io');
    await orca.ensureExtensionAvailable('cloud.sn.io');
    await orca.ensureExtensionAvailable('cloud.sn.io');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight discovery request across concurrent callers', async () => {
    const { orca, fakeFetch } = makeOrca([
      jsonResponse({ kind: 'APIGroupList', groups: [{ name: 'cloud.sn.io', versions: [] }] }),
    ]);
    await Promise.all([
      orca.ensureExtensionAvailable('cloud.sn.io'),
      orca.ensureExtensionAvailable('cloud.sn.io'),
      orca.ensureExtensionAvailable('cloud.sn.io'),
    ]);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed discovery attempt — the next call retries', async () => {
    const { orca, fakeFetch } = makeOrca([
      jsonResponse({ error: 'boom' }, { status: 500 }),
      jsonResponse({ kind: 'APIGroupList', groups: [{ name: 'cloud.sn.io', versions: [] }] }),
    ]);
    await expect(orca.ensureExtensionAvailable('cloud.sn.io')).rejects.toBeInstanceOf(
      InternalServerError,
    );
    await expect(orca.ensureExtensionAvailable('cloud.sn.io')).resolves.toBeUndefined();
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });
});
