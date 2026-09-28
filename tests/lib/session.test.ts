// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the session() ergonomic helper.
 */

import { Orca } from '../../src/client';
import type { OrcaOptions } from '../../src/client';
import { Stream } from '../../src/core/streaming';
import type { SessionEvent } from '../../src/resources/sessions/events';
import type { Fetch } from '../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('orca.session() handle', () => {
  it('exposes sessionId', () => {
    const { orca } = makeClient();
    const handle = orca.session('session_456');

    expect(handle.sessionId).toBe('session_456');
  });

  it('events.send() calls the underlying method with pre-filled sessionId', async () => {
    const { orca, calls } = makeClient();
    const handle = orca.session('session_xyz');
    await handle.events.send({
      events: [{ type: 'user.message', content: [{ type: 'text', text: 'test' }] }],
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/sessions/session_xyz/events');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.events[0].type).toBe('user.message');
  });

  it('events.stream() returns a Stream instance with pre-filled sessionId', async () => {
    const mockEvents: SessionEvent[] = [{ id: 'evt_1', type: 'session.status_running' }];

    const { orca, calls } = makeClient(async () => makeSseResponse(mockEvents));
    const handle = orca.session('session_xyz');
    const stream = await handle.events.stream({ from_cursor: 'evt_previous' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/sessions/session_xyz/events/stream');
    expect(new URL(calls[0]!.url).searchParams.get('from_cursor')).toBe('evt_previous');
    expect(stream).toBeInstanceOf(Stream);

    // Consume stream to avoid open handles.
    for await (const _evt of stream) {
      // no-op
    }
  });

  it('events.stream() keeps the legacy RequestOptions form on the handle', async () => {
    const { orca, calls } = makeClient(async () => makeSseResponse([]));
    const handle = orca.session('session_xyz');
    const stream = await handle.events.stream({
      headers: { 'X-Test-Header': 'legacy-handle-stream' },
    });

    expect(new URL(calls[0]!.url).search).toBe('');
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe(
      'legacy-handle-stream',
    );
    for await (const _event of stream) {
      // drain
    }
  });

  it('threads.events.stream() forwards thread resume params', async () => {
    const { orca, calls } = makeClient(async () => makeSseResponse([]));
    const handle = orca.session('session_xyz');
    const stream = await handle.threads.events.stream(
      'thread_xyz',
      { from_cursor: 'evt_previous', event_deltas: 'agent.message' },
      { headers: { 'X-Test-Header': 'thread-stream' } },
    );

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toContain('/v1/sessions/session_xyz/threads/thread_xyz/stream');
    expect(url.searchParams.get('from_cursor')).toBe('evt_previous');
    expect(url.searchParams.get('event_deltas')).toBe('agent.message');
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe('thread-stream');

    for await (const _event of stream) {
      // drain
    }
  });

  it('threads.events.stream() keeps the legacy RequestOptions form on the handle', async () => {
    const { orca, calls } = makeClient(async () => makeSseResponse([]));
    const handle = orca.session('session_xyz');
    const stream = await handle.threads.events.stream('thread_xyz', {
      headers: { 'X-Test-Header': 'legacy-thread-stream' },
    });

    const url = new URL(calls[0]!.url);
    expect(url.search).toBe('');
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBe(
      'legacy-thread-stream',
    );

    for await (const _event of stream) {
      // drain
    }
  });

  it('resources.add() calls underlying method with pre-filled sessionId', async () => {
    const { orca, calls } = makeClient(
      async () =>
        new Response(JSON.stringify({ id: 'res_1', type: 'file' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const handle = orca.session('session_xyz');
    await handle.resources.add({ type: 'file', file_id: 'file_doc' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/sessions/session_xyz/resources');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
  });

  it('files.download() calls underlying method with pre-filled sessionId', async () => {
    const { orca, calls } = makeClient(
      async () =>
        new Response('file-bytes', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        }),
    );
    const handle = orca.session('session_xyz');
    const response = await handle.files.download('file_abc');

    expect(await response.text()).toBe('file-bytes');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/sessions/session_xyz/files/file_abc/content');
    expect((calls[0]!.init?.headers as Headers).get('accept')).toBe('application/octet-stream');
  });
});
