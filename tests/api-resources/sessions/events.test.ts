// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Sessions Events sub-resource.
 *
 * Tests SSE streaming via a mock ReadableStream response.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import { Stream } from '../../../src/core/streaming';
import type { SessionEvent } from '../../../src/resources/sessions/events';
import type { Fetch } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResp(status = 204): Response {
  return new Response(null, { status });
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
    return emptyResp(204);
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

/**
 * Build a mock SSE Response containing the given events serialized as SSE.
 */
function makeSseResponse(events: SessionEvent[]): Response {
  const sseBody = events
    .map((e) => `data: ${JSON.stringify(e)}\n\n`)
    .join('');

  const encoder = new TextEncoder();
  const bytes = encoder.encode(sseBody);
  let offset = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      // Yield one byte at a time to stress the chunking logic.
      controller.enqueue(bytes.slice(offset, offset + 1));
      offset += 1;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

// ---------------------------------------------------------------------------
// 1. list()
// ---------------------------------------------------------------------------

describe('Events.list()', () => {
  const pageBody = {
    data: [
      { id: 'evt_1', type: 'user.message', processed_at: '2026-01-01T00:00:00Z' },
      { id: 'evt_2', type: 'agent.message', processed_at: '2026-01-01T00:00:01Z' },
    ],
    has_more: false,
    first_id: 'evt_1',
    last_id: 'evt_2',
  };

  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient(
      async () => jsonResp(pageBody),
    );
    await orca.sessions.events.list('session_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/events',
    );
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('returns a PageCursor', async () => {
    const { orca } = makeClient(async () => jsonResp(pageBody));
    const page = await orca.sessions.events.list('session_xyz');
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(2);
    expect(page.data[0]!.id).toBe('evt_1');
  });

  it('forwards all event-list query params', async () => {
    const { orca, calls } = makeClient(async () => jsonResp(pageBody));
    await orca.sessions.events.list('session_xyz', {
      limit: 50,
      order: 'asc',
      page: 'cursor-abc',
      'created_at[gt]': '2026-01-01T00:00:00Z',
      'created_at[gte]': '2026-01-02T00:00:00Z',
      'created_at[lt]': '2026-02-01T00:00:00Z',
      'created_at[lte]': '2026-02-02T00:00:00Z',
      types: ['user.message', 'agent.message'],
      subpath: 'child/path',
    });

    const url = calls[0]!.url;
    expect(url).toContain('limit=50');
    expect(url).toContain('order=asc');
    expect(url).toContain('page=cursor-abc');
    const search = new URL(url).searchParams;
    expect(search.get('created_at[gt]')).toBe('2026-01-01T00:00:00Z');
    expect(search.get('created_at[gte]')).toBe('2026-01-02T00:00:00Z');
    expect(search.get('created_at[lt]')).toBe('2026-02-01T00:00:00Z');
    expect(search.get('created_at[lte]')).toBe('2026-02-02T00:00:00Z');
    expect(search.getAll('types')).toEqual(['user.message', 'agent.message']);
    expect(search.get('subpath')).toBe('child/path');
  });

  it('supports async iteration', async () => {
    const page1 = {
      data: [{ id: 'evt_1', type: 'user.message' }],
      has_more: true,
      last_id: 'evt_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ id: 'evt_2', type: 'agent.message' }],
      has_more: false,
      last_id: 'evt_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const event of orca.sessions.events.list('session_xyz')) {
      ids.push(event.id);
    }

    expect(ids).toEqual(['evt_1', 'evt_2']);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. send()
// ---------------------------------------------------------------------------

describe('Events.send()', () => {
  it('sends POST and returns the appended events', async () => {
    const appended = { data: [{ id: 'evt_1', type: 'user.message' }] };
    const { orca, calls } = makeClient(async () => jsonResp(appended));
    const result = await orca.sessions.events.send('session_xyz', {
      events: [{ type: 'user.message', content: [{ type: 'text', text: 'Hello!' }] }],
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/sessions/session_xyz/events');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].type).toBe('user.message');
    expect(body.events[0].content).toEqual([{ type: 'text', text: 'Hello!' }]);
    expect(result).toEqual(appended);
  });

  it('sends multiple events in a single call', async () => {
    const { orca, calls } = makeClient(async () => emptyResp(204));
    await orca.sessions.events.send('session_xyz', {
      events: [
        { type: 'user.message', content: [{ type: 'text', text: 'Hi' }] },
        { type: 'user.interrupt' },
      ],
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.events).toHaveLength(2);
    expect(body.events[1].type).toBe('user.interrupt');
  });
});

// ---------------------------------------------------------------------------
// 3. stream() — SSE
// ---------------------------------------------------------------------------

describe('Events.stream()', () => {
  it('sends GET to the /events/stream URL', async () => {
    const mockEvents: SessionEvent[] = [
      { id: 'evt_1', type: 'session.status_idle' },
    ];

    const { orca, calls } = makeClient(async () => makeSseResponse(mockEvents));
    const stream = await orca.sessions.events.stream('session_xyz');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/sessions/session_xyz/events/stream',
    );

    // Consume the stream to avoid open handles.
    for await (const _evt of stream) {
      // no-op
    }
  });

  it('returns a Stream instance', async () => {
    const mockEvents: SessionEvent[] = [{ id: 'evt_1', type: 'user.message' }];
    const { orca } = makeClient(async () => makeSseResponse(mockEvents));

    const stream = await orca.sessions.events.stream('session_xyz');
    expect(stream).toBeInstanceOf(Stream);
  });

  it('yields events via async iteration', async () => {
    const mockEvents: SessionEvent[] = [
      { id: 'evt_1', type: 'user.message', content: 'Hello' },
      { id: 'evt_2', type: 'agent.message', content: 'World' },
    ];

    const { orca } = makeClient(async () => makeSseResponse(mockEvents));
    const stream = await orca.sessions.events.stream('session_xyz');

    const received: SessionEvent[] = [];
    for await (const event of stream) {
      received.push(event);
    }

    expect(received).toHaveLength(2);
    expect(received[0]!.id).toBe('evt_1');
    expect(received[0]!.type).toBe('user.message');
    expect(received[1]!.id).toBe('evt_2');
    expect(received[1]!.type).toBe('agent.message');
  });

  it('handles multiple event types in stream', async () => {
    const mockEvents: SessionEvent[] = [
      { id: 'evt_1', type: 'session.status_running' },
      { id: 'evt_2', type: 'user.message', content: 'prompt' },
      { id: 'evt_3', type: 'agent.message', content: 'response' },
      { id: 'evt_4', type: 'session.status_idle' },
    ];

    const { orca } = makeClient(async () => makeSseResponse(mockEvents));
    const stream = await orca.sessions.events.stream('session_xyz');

    const types: string[] = [];
    for await (const event of stream) {
      types.push(event.type);
    }

    expect(types).toEqual([
      'session.status_running',
      'user.message',
      'agent.message',
      'session.status_idle',
    ]);
  });

  it('forwards stream resume and delta query params with request options', async () => {
    const mockEvents: SessionEvent[] = [{ id: 'evt_1', type: 'agent.message' }];
    const { orca, calls } = makeClient(async () => makeSseResponse(mockEvents));
    const stream = await orca.sessions.events.stream(
      'session_xyz',
      {
        from_cursor: 'evt_previous',
        subpath: 'child/path',
        event_deltas: ['agent.message', 'agent.thinking'],
      },
      { headers: { 'X-Test-Header': 'stream' } },
    );

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('from_cursor')).toBe('evt_previous');
    expect(url.searchParams.get('subpath')).toBe('child/path');
    expect(url.searchParams.getAll('event_deltas')).toEqual([
      'agent.message',
      'agent.thinking',
    ]);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('stream');
    for await (const _event of stream) {
      // consume stream
    }
  });

  it('keeps the legacy second-argument RequestOptions form', async () => {
    const controller = new AbortController();
    const { orca, calls } = makeClient(async () => makeSseResponse([]));
    const stream = await orca.sessions.events.stream('session_xyz', {
      headers: { 'X-Test-Header': 'legacy-stream' },
      signal: controller.signal,
    });

    expect(new URL(calls[0]!.url).search).toBe('');
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('legacy-stream');
    const forwardedSignal = calls[0]!.init?.signal;
    expect(forwardedSignal?.aborted).toBe(false);
    controller.abort();
    expect(forwardedSignal?.aborted).toBe(true);
    for await (const _event of stream) {
      // consume stream
    }
  });
});
