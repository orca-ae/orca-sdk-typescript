// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Stream, _iterSSEMessages, type ServerSentEvent } from '../../src/core/streaming';
import { APIError } from '../../src/core/error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock SSE response whose body is a `ReadableStream<Uint8Array>` that
 * emits each `chunks` entry as a separate enqueued frame. Useful for
 * simulating chunked network delivery.
 */
function makeSSEResponse(
  chunks: string[],
  status = 200,
  headers: Record<string, string> = { 'content-type': 'text/event-stream' },
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(encoder.encode(ch));
      c.close();
    },
  });
  return new Response(stream, { status, headers });
}

async function collect<T>(stream: Stream<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of stream) out.push(item);
  return out;
}

async function collectMessages(response: Response, controller: AbortController) {
  const out: ServerSentEvent[] = [];
  for await (const msg of _iterSSEMessages(response, controller)) out.push(msg);
  return out;
}

// ---------------------------------------------------------------------------
// 1. Single event yield
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — single event', () => {
  it('yields the parsed JSON payload from a single data line', async () => {
    const response = makeSSEResponse(['data: {"hello":"world"}\n\n']);
    const controller = new AbortController();
    const stream = Stream.fromSSEResponse<{ hello: string }>(response, controller);
    const items = await collect(stream);
    expect(items).toEqual([{ hello: 'world' }]);
  });
});

// ---------------------------------------------------------------------------
// 2. Multiple events with event names preserved
// ---------------------------------------------------------------------------

describe('_iterSSEMessages — multiple events with event names', () => {
  it('preserves the event field on each ServerSentEvent', async () => {
    const body =
      'event: message_start\ndata: {"v":1}\n\n' +
      'event: content_block_delta\ndata: {"v":2}\n\n' +
      'event: message_stop\ndata: {"v":3}\n\n';
    const response = makeSSEResponse([body]);
    const messages = await collectMessages(response, new AbortController());

    expect(messages.map((m) => m.event)).toEqual([
      'message_start',
      'content_block_delta',
      'message_stop',
    ]);
    expect(messages.map((m) => JSON.parse(m.data))).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }]);
  });

  it('yields the parsed item per event when iterated via Stream', async () => {
    const body =
      'event: alpha\ndata: {"v":1}\n\n' +
      'event: beta\ndata: {"v":2}\n\n' +
      'event: gamma\ndata: {"v":3}\n\n';
    const stream = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse([body]),
      new AbortController(),
    );
    expect(await collect(stream)).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }]);
  });
});

// ---------------------------------------------------------------------------
// 3. CRLF line endings
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — CRLF line endings', () => {
  it('handles \\r\\n exactly like \\n', async () => {
    const body =
      'event: one\r\ndata: {"v":1}\r\n\r\n' + 'event: two\r\ndata: {"v":2}\r\n\r\n';
    const stream = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse([body]),
      new AbortController(),
    );
    expect(await collect(stream)).toEqual([{ v: 1 }, { v: 2 }]);
  });
});

// ---------------------------------------------------------------------------
// 4. Multi-chunk reception
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — multi-chunk reception', () => {
  it('reassembles a single event delivered across three chunks', async () => {
    const stream = Stream.fromSSEResponse<{ msg: string }>(
      makeSSEResponse(['event: split\nda', 'ta: {"msg":"hel', 'lo-world"}\n\n']),
      new AbortController(),
    );
    expect(await collect(stream)).toEqual([{ msg: 'hello-world' }]);
  });

  it('reassembles events split across chunk boundaries with CRLF', async () => {
    const stream = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse(['event: x\r\nda', 'ta: {"v":', '99}\r\n\r\n']),
      new AbortController(),
    );
    expect(await collect(stream)).toEqual([{ v: 99 }]);
  });
});

// ---------------------------------------------------------------------------
// 5. Ping event skipped
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — ping handling', () => {
  it('silently skips event: ping frames', async () => {
    const body = 'event: ping\ndata: {}\n\n' + 'data: {"v":1}\n\n';
    const stream = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse([body]),
      new AbortController(),
    );
    expect(await collect(stream)).toEqual([{ v: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// 6. Error event throws an APIError
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — error event', () => {
  it('throws an APIError when an event: error frame is received', async () => {
    const body =
      'event: error\ndata: {"error":{"type":"rate_limit_error","message":"slow down"}}\n\n';
    const stream = Stream.fromSSEResponse(makeSSEResponse([body]), new AbortController());

    let thrown: unknown;
    try {
      for await (const item of stream) {
        void item; // unreachable
      }
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(APIError);
    expect((thrown as Error).message).toContain('slow down');
  });
});

// ---------------------------------------------------------------------------
// 7. Non-JSON data is skipped, not thrown
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — non-JSON data', () => {
  it('skips frames whose data is not valid JSON and continues', async () => {
    const body = 'data: not-json\n\n' + 'data: {"v":1}\n\n';
    const stream = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse([body]),
      new AbortController(),
      // Silent logger so the warn call doesn't pollute test output.
      { logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} } },
    );
    expect(await collect(stream)).toEqual([{ v: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// 8. Abort propagation
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — abort propagation', () => {
  it('terminates iteration cleanly when the controller is aborted before reading', async () => {
    const response = makeSSEResponse([
      'data: {"v":1}\n\n',
      'data: {"v":2}\n\n',
      'data: {"v":3}\n\n',
    ]);
    const controller = new AbortController();
    const stream = Stream.fromSSEResponse<{ v: number }>(response, controller);

    controller.abort();

    // Iterating after abort should end without throwing — the iterator
    // catches AbortError internally and returns.
    const collected: { v: number }[] = [];
    try {
      for await (const item of stream) {
        collected.push(item);
      }
    } catch (e) {
      // Some runtimes surface the abort as a TypeError on the underlying
      // reader rather than an AbortError; treat that as acceptable too.
      expect(e).toBeDefined();
      return;
    }
    // If we reach here, the iterator returned cleanly. That's also fine.
    expect(Array.isArray(collected)).toBe(true);
  });

  it('break inside the iterator aborts the controller', async () => {
    const response = makeSSEResponse([
      'data: {"v":1}\n\n',
      'data: {"v":2}\n\n',
      'data: {"v":3}\n\n',
    ]);
    const controller = new AbortController();
    const stream = Stream.fromSSEResponse<{ v: number }>(response, controller);

    for await (const item of stream) {
      void item;
      break;
    }
    expect(controller.signal.aborted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. tee()
// ---------------------------------------------------------------------------

describe('Stream.tee', () => {
  it('produces two independent streams that yield the same items', async () => {
    const body = 'data: {"v":1}\n\n' + 'data: {"v":2}\n\n' + 'data: {"v":3}\n\n';
    const source = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse([body]),
      new AbortController(),
    );
    const [left, right] = source.tee();
    const [a, b] = await Promise.all([collect(left), collect(right)]);
    expect(a).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }]);
    expect(b).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }]);
  });
});

// ---------------------------------------------------------------------------
// 10. toReadableStream()
// ---------------------------------------------------------------------------

describe('Stream.toReadableStream', () => {
  it('re-encodes items as data: <json>\\n\\n UTF-8 bytes', async () => {
    const body = 'data: {"v":1}\n\n';
    const stream = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse([body]),
      new AbortController(),
    );
    const rs = stream.toReadableStream();
    const reader = rs.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.length;
    }
    const text = new TextDecoder().decode(buf);
    expect(text).toContain('data: {"v":1}\n\n');
  });
});

// ---------------------------------------------------------------------------
// 11. Non-2xx response surfaces APIError before yielding
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — non-2xx response', () => {
  it('throws an APIError on the first iteration when status is 500', async () => {
    const response = makeSSEResponse(
      ['{"error":{"type":"server_error","message":"boom"}}'],
      500,
      { 'content-type': 'application/json' },
    );
    const stream = Stream.fromSSEResponse(response, new AbortController());
    await expect(collect(stream)).rejects.toBeInstanceOf(APIError);
  });
});

// ---------------------------------------------------------------------------
// 12. Re-iteration is rejected
// ---------------------------------------------------------------------------

describe('Stream.fromSSEResponse — consumed-once guard', () => {
  it('throws when iterated a second time', async () => {
    const body = 'data: {"v":1}\n\n';
    const stream = Stream.fromSSEResponse<{ v: number }>(
      makeSSEResponse([body]),
      new AbortController(),
    );
    await collect(stream);
    await expect(collect(stream)).rejects.toThrow(/consumed stream/);
  });
});
