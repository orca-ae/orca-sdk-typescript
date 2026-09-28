// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Server-Sent Events (SSE) streaming primitives.
 *
 * Session and thread event endpoints (e.g. `/v1/sessions/{session_id}/events/stream`)
 * emit SSE; `Stream<Item>` wraps the raw `Response` body and exposes a typed
 * async iterator. The stream keeps no event-name allowlist — every
 * well-formed event with a `data: <json>` payload is yielded to the caller,
 * who decides how to interpret the `event` field.
 *
 * Special cases:
 *  - `event: ping` is silently skipped (heartbeat).
 *  - `event: error` is parsed and thrown as an `APIError`.
 *  - Non-JSON `data` is logged and skipped without throwing.
 */

import { APIError, OrcaError } from './error';
import { isAbortError } from '../internal/errors';
import { findDoubleNewlineIndex, LineDecoder } from '../internal/decoders/line';
import { makeReadableStream } from '../internal/shims';
import { ReadableStreamToAsyncIterable } from '../internal/stream-utils';
import { encodeUTF8 } from '../internal/utils/bytes';
import { loggerFor, type LoggableClient, type Logger } from '../internal/utils/log';
import { safeJSON } from '../internal/utils/values';

type Bytes = string | ArrayBuffer | Uint8Array | null | undefined;

export type ServerSentEvent = {
  event: string | null;
  data: string;
  raw: string[];
};

/**
 * Resolve a logger from an opaque client reference. Orca clients implement
 * `LoggableClient`; anything else falls back to `console` so decode
 * failures still surface.
 */
function resolveLogger(client: unknown): Logger {
  if (client && typeof client === 'object' && ('logger' in client || 'logLevel' in client)) {
    return loggerFor(client as LoggableClient);
  }
  return console;
}

export class Stream<Item> implements AsyncIterable<Item> {
  controller: AbortController;
  // Held as `unknown` so this module stays decoupled from the concrete client
  // type — narrowed to `LoggableClient` via `pickLogger` when used.
  #client: unknown;

  constructor(
    private iterator: () => AsyncIterator<Item>,
    controller: AbortController,
    client?: unknown,
  ) {
    this.controller = controller;
    this.#client = client;
  }

  static fromSSEResponse<Item>(
    response: Response,
    controller: AbortController,
    client?: unknown,
  ): Stream<Item> {
    let consumed = false;
    const logger = resolveLogger(client);

    async function* iterator(): AsyncIterator<Item, void, undefined> {
      if (consumed) {
        throw new OrcaError(
          'Cannot iterate over a consumed stream, use `.tee()` to split the stream.',
        );
      }
      consumed = true;

      // Surface non-2xx responses BEFORE we start yielding so callers see
      // the real error rather than an empty stream.
      if (!response.ok) {
        const bodyText = await safeReadText(response);
        const parsed = bodyText ? (safeJSON(bodyText) ?? bodyText) : undefined;
        throw APIError.generate(response.status, parsed, undefined, response.headers);
      }

      let done = false;
      try {
        for await (const sse of _iterSSEMessages(response, controller)) {
          if (sse.event === 'ping') {
            continue;
          }

          if (sse.event === 'error') {
            const body = safeJSON(sse.data) ?? sse.data;
            throw APIError.generate(response.status, body, undefined, response.headers);
          }

          if (!sse.data) {
            // Pure comment/heartbeat line with no data; nothing to yield.
            continue;
          }

          const parsed = safeJSON(sse.data);
          if (parsed === undefined) {
            logger.warn?.(
              `Could not parse SSE message data as JSON; skipping event.`,
              { event: sse.event, data: sse.data },
            );
            continue;
          }

          yield parsed as Item;
        }
        done = true;
      } catch (e) {
        // If the user calls `stream.controller.abort()`, we should exit without throwing.
        if (isAbortError(e)) return;
        throw e;
      } finally {
        // If the user `break`s, abort the ongoing request so the body
        // reader is released and the underlying connection can close.
        if (!done) controller.abort();
      }
    }

    return new Stream(iterator, controller, client);
  }

  [Symbol.asyncIterator](): AsyncIterator<Item> {
    return this.iterator();
  }

  /**
   * Splits the stream into two independent streams sharing one upstream
   * source. Each branch can be iterated at its own pace; pulled values are
   * buffered until both consumers have observed them.
   */
  tee(): [Stream<Item>, Stream<Item>] {
    const left: Array<Promise<IteratorResult<Item>>> = [];
    const right: Array<Promise<IteratorResult<Item>>> = [];
    const iterator = this.iterator();

    const teeIterator = (queue: Array<Promise<IteratorResult<Item>>>): AsyncIterator<Item> => {
      return {
        next: () => {
          if (queue.length === 0) {
            const result = iterator.next();
            left.push(result);
            right.push(result);
          }
          return queue.shift()!;
        },
      };
    };

    return [
      new Stream(() => teeIterator(left), this.controller, this.#client),
      new Stream(() => teeIterator(right), this.controller, this.#client),
    ];
  }

  /**
   * Re-encodes the stream as an SSE-formatted `ReadableStream<Uint8Array>`
   * so consumers can pipe it (e.g. forwarding events from an edge function
   * back to the browser). Each emitted item becomes a single
   * `data: <json>\n\n` block.
   */
  toReadableStream(): ReadableStream {
    const self = this;
    let iter: AsyncIterator<Item>;

    return makeReadableStream({
      async start() {
        iter = self[Symbol.asyncIterator]();
      },
      async pull(ctrl: ReadableStreamDefaultController<Uint8Array>) {
        try {
          const { value, done } = await iter.next();
          if (done) return ctrl.close();

          const bytes = encodeUTF8(`data: ${JSON.stringify(value)}\n\n`);
          ctrl.enqueue(bytes);
        } catch (err) {
          ctrl.error(err);
        }
      },
      async cancel() {
        await iter.return?.();
      },
    });
  }
}

/**
 * Read the raw error body without throwing if the consumer is already in
 * an error path. `response.text()` may itself throw on some shims, so we
 * shield the rejection.
 */
async function safeReadText(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

/**
 * Async generator that consumes an SSE-formatted `Response.body`, yielding
 * one `ServerSentEvent` per double-newline-delimited block.
 *
 * Exported for internal reuse (and tests); end users should iterate
 * through `Stream` instead.
 */
export async function* _iterSSEMessages(
  response: Response,
  controller: AbortController,
): AsyncGenerator<ServerSentEvent, void, unknown> {
  if (!response.body) {
    controller.abort();
    if (
      typeof (globalThis as { navigator?: { product?: string } }).navigator !== 'undefined' &&
      (globalThis as { navigator?: { product?: string } }).navigator?.product === 'ReactNative'
    ) {
      throw new OrcaError(
        `The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`,
      );
    }
    throw new OrcaError(`Attempted to iterate over a response with no body`);
  }

  const sseDecoder = new SSEDecoder();
  const lineDecoder = new LineDecoder();

  const iter = ReadableStreamToAsyncIterable<Bytes>(response.body);
  for await (const sseChunk of iterSSEChunks(iter)) {
    for (const line of lineDecoder.decode(sseChunk)) {
      const sse = sseDecoder.decode(line);
      if (sse) yield sse;
    }
  }

  for (const line of lineDecoder.flush()) {
    const sse = sseDecoder.decode(line);
    if (sse) yield sse;
  }
}

/**
 * Buffers incoming bytes until a complete SSE event boundary (double
 * newline) is observed, then yields each block as its own `Uint8Array`.
 * Splitting on event boundaries (rather than line boundaries) keeps
 * partial-line state out of the SSE decoder.
 */
async function* iterSSEChunks(
  iterator: AsyncIterableIterator<Bytes>,
): AsyncGenerator<Uint8Array> {
  let data = new Uint8Array();

  for await (const chunk of iterator) {
    if (chunk == null) {
      continue;
    }

    const binaryChunk =
      chunk instanceof ArrayBuffer ? new Uint8Array(chunk)
      : typeof chunk === 'string' ? encodeUTF8(chunk)
      : chunk;

    const newData = new Uint8Array(data.length + binaryChunk.length);
    newData.set(data);
    newData.set(binaryChunk, data.length);
    data = newData;

    let patternIndex;
    while ((patternIndex = findDoubleNewlineIndex(data)) !== -1) {
      yield data.slice(0, patternIndex);
      data = data.slice(patternIndex);
    }
  }

  if (data.length > 0) {
    yield data;
  }
}

class SSEDecoder {
  private data: string[];
  private event: string | null;
  private chunks: string[];

  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }

  decode(line: string): ServerSentEvent | null {
    if (line.endsWith('\r')) {
      line = line.substring(0, line.length - 1);
    }

    if (!line) {
      // empty line and we didn't previously encounter any messages
      if (!this.event && !this.data.length) return null;

      const sse: ServerSentEvent = {
        event: this.event,
        data: this.data.join('\n'),
        raw: this.chunks,
      };

      this.event = null;
      this.data = [];
      this.chunks = [];

      return sse;
    }

    this.chunks.push(line);

    if (line.startsWith(':')) {
      // SSE comment line.
      return null;
    }

    let [fieldname, , value] = partition(line, ':');

    if (value.startsWith(' ')) {
      value = value.substring(1);
    }

    if (fieldname === 'event') {
      this.event = value;
    } else if (fieldname === 'data') {
      this.data.push(value);
    }

    return null;
  }
}

function partition(str: string, delimiter: string): [string, string, string] {
  const index = str.indexOf(delimiter);
  if (index !== -1) {
    return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
  }

  return [str, '', ''];
}
