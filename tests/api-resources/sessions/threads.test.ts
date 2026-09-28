// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Sessions Threads sub-resource and its events sub-resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import { Stream } from '../../../src/core/streaming';
import type { SessionThread } from '../../../src/resources/sessions/threads';
import type { SessionAgentMember } from '../../../src/resources/sessions/sessions';
import type { SessionEvent } from '../../../src/resources/sessions/events';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_FIXTURE: SessionAgentMember = {
  id: 'agent_abc',
  type: 'agent',
  name: 'Test Agent',
  description: null,
  model: { id: 'claude-sonnet-4-6' },
  system: null,
  tools: [],
  mcp_servers: [],
  skills: [],
  version: 1,
};

const THREAD_FIXTURE: SessionThread = {
  id: 'thread_xyz',
  type: 'session_thread',
  session_id: 'session_xyz',
  agent: AGENT_FIXTURE,
  parent_thread_id: null,
  status: 'idle',
  stats: null,
  usage: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSseResponse(events: SessionEvent[]): Response {
  const sseBody = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(sseBody);
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + 1));
      offset += 1;
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
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
    return jsonResp(THREAD_FIXTURE);
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
// Threads.retrieve()
// ---------------------------------------------------------------------------

describe('Threads.retrieve()', () => {
  it('sends GET to the correct nested URL', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.threads.retrieve('session_xyz', 'thread_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/threads/thread_xyz',
    );
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('URL-encodes all path segments', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.threads.retrieve('session/slash', 'thread/slash');

    expect(calls[0]!.url).toContain('session%2Fslash');
    expect(calls[0]!.url).toContain('thread%2Fslash');
  });

  it('exposes required response fields with their wire nullability', async () => {
    const { orca } = makeClient();
    const thread = await orca.sessions.threads.retrieve('session_xyz', 'thread_xyz');
    const parentThreadId: string | null = thread.parent_thread_id;
    const archivedAt: string | null = thread.archived_at;

    expect(thread.type).toBe('session_thread');
    expect(thread.status).toBe('idle');
    expect(thread.stats).toBeNull();
    expect(thread.usage).toBeNull();
    expect(parentThreadId).toBeNull();
    expect(archivedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Threads.list()
// ---------------------------------------------------------------------------

describe('Threads.list()', () => {
  const pageBody = {
    data: [THREAD_FIXTURE],
    has_more: false,
    first_id: THREAD_FIXTURE.id,
    last_id: THREAD_FIXTURE.id,
  };

  it('sends GET to the correct URL and returns a PageCursor', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    const page = await orca.sessions.threads.list('session_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/threads',
    );
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.id).toBe(THREAD_FIXTURE.id);
  });

  it('forwards limit and page as query params', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.sessions.threads.list('session_xyz', {
      limit: 20,
      page: 'cursor-1',
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=20');
    expect(url).toContain('page=cursor-1');
    expect(url).not.toContain('include_archived');
    expect(url).not.toContain('order');
  });

  it('supports async iteration across pages', async () => {
    const page1 = {
      data: [{ ...THREAD_FIXTURE, id: 'thread_1' }],
      has_more: true,
      last_id: 'thread_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ ...THREAD_FIXTURE, id: 'thread_2' }],
      has_more: false,
      last_id: 'thread_2',
    };

    let n = 0;
    const fakeFetch: Fetch = async () => {
      n += 1;
      return jsonResp(n === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const thread of orca.sessions.threads.list('session_xyz')) {
      ids.push(thread.id);
    }

    expect(ids).toEqual(['thread_1', 'thread_2']);
    expect(n).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Threads.archive()
// ---------------------------------------------------------------------------

describe('Threads.archive()', () => {
  it('sends POST to the /archive sub-path', async () => {
    const { orca, calls } = makeClient();
    await orca.sessions.threads.archive('session_xyz', 'thread_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/threads/thread_xyz/archive',
    );
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
  });
});

// ---------------------------------------------------------------------------
// Threads.events.list()
// ---------------------------------------------------------------------------

describe('Threads.events.list()', () => {
  const pageBody = {
    data: [
      { id: 'evt_1', type: 'user.message' },
      { id: 'evt_2', type: 'agent.message' },
    ],
    has_more: false,
    first_id: 'evt_1',
    last_id: 'evt_2',
  };

  it('sends GET to the per-thread events URL', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.sessions.threads.events.list('session_xyz', 'thread_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/threads/thread_xyz/events',
    );
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('returns a PageCursor', async () => {
    const { orca } = makeClient(async () => jsonResp(pageBody));
    const page = await orca.sessions.threads.events.list('session_xyz', 'thread_xyz');
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(2);
  });

  it('forwards only the supported pagination query params', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.sessions.threads.events.list('session_xyz', 'thread_xyz', {
      limit: 20,
      page: 'cursor-1',
    });

    const search = new URL(calls[0]!.url).searchParams;
    expect(search.get('limit')).toBe('20');
    expect(search.get('page')).toBe('cursor-1');
    expect(search.has('order')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Threads.events.stream()
// ---------------------------------------------------------------------------

describe('Threads.events.stream()', () => {
  it('sends GET to the /events/stream URL and returns a Stream', async () => {
    const mock: SessionEvent[] = [{ id: 'evt_1', type: 'session.status_idle' }];
    const { orca, calls } = makeClient(async () => makeSseResponse(mock));

    const stream = await orca.sessions.threads.events.stream('session_xyz', 'thread_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/threads/thread_xyz/stream',
    );
    expect(stream).toBeInstanceOf(Stream);

    for await (const _ of stream) {
      // drain
    }
  });

  it('yields events via async iteration', async () => {
    const mock: SessionEvent[] = [
      { id: 'evt_1', type: 'user.message', content: 'Hello' },
      { id: 'evt_2', type: 'agent.message', content: 'World' },
    ];
    const { orca } = makeClient(async () => makeSseResponse(mock));

    const stream = await orca.sessions.threads.events.stream('session_xyz', 'thread_xyz');

    const received: SessionEvent[] = [];
    for await (const e of stream) {
      received.push(e);
    }

    expect(received).toHaveLength(2);
    expect(received[0]!.id).toBe('evt_1');
    expect(received[1]!.id).toBe('evt_2');
  });

  it('forwards resume and delta query params with request options', async () => {
    const { orca, calls } = makeClient(async () => makeSseResponse([]));
    const stream = await orca.sessions.threads.events.stream(
      'session_xyz',
      'thread_xyz',
      { from_cursor: 'evt_previous', event_deltas: ['agent.message', 'agent.thinking'] },
      { headers: new Headers({ 'X-Test-Header': 'stream' }) },
    );

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('from_cursor')).toBe('evt_previous');
    expect(url.searchParams.getAll('event_deltas')).toEqual(['agent.message', 'agent.thinking']);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('stream');

    for await (const _ of stream) {
      // drain
    }
  });

  it('keeps the legacy third-argument RequestOptions form', async () => {
    const { orca, calls } = makeClient(async () => makeSseResponse([]));
    const stream = await orca.sessions.threads.events.stream('session_xyz', 'thread_xyz', {
      headers: new Headers({ 'X-Test-Header': 'legacy-stream' }),
    });

    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('legacy-stream');
    expect(new URL(calls[0]!.url).search).toBe('');

    for await (const _ of stream) {
      // drain
    }
  });
});
