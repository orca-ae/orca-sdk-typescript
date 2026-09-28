// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Runtime helpers for working with platform-provided globals.
 *
 * The Orca SDK targets Node 20+, modern browsers, Bun, Deno, and edge
 * runtimes — all of which expose a global `fetch`. We bind to `globalThis`
 * so callers can swap the implementation by reassigning `globalThis.fetch`
 * and still have their override picked up.
 */

import type { Fetch } from './builtin-types';

export function getDefaultFetch(): Fetch {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error(
    '`fetch` is not defined as a global; either pass `fetch` to `new Orca({ fetch })` or polyfill the global, e.g. `globalThis.fetch = fetch`.',
  );
}

/**
 * Converts an `AsyncIterable<Uint8Array>` into a `ReadableStream<Uint8Array>`.
 *
 * Used by the multipart upload helpers when an async-iterable file stream
 * (e.g. `fs.createReadStream`) must be attached to a `FormData` entry.
 */
export function ReadableStreamFrom(iterable: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const RS = (globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream;
  if (typeof RS === 'undefined') {
    throw new Error(
      '`ReadableStream` is not defined as a global; you will need to polyfill it.',
    );
  }
  const iter = iterable[Symbol.asyncIterator]();
  return new RS<Uint8Array>({
    async pull(controller) {
      const { done, value } = await iter.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      await iter.return?.();
    },
  });
}

type ReadableStreamArgs = ConstructorParameters<typeof ReadableStream>;

/**
 * Constructs a `ReadableStream` using the platform-provided global. The
 * `Stream<Item>` class uses this to turn its async iterator back into a
 * pipeable stream. Every runtime we target ships `ReadableStream` natively;
 * this helper exists so unsupported environments get a clear error message
 * instead of a cryptic `ReferenceError`.
 */
export function makeReadableStream(...args: ReadableStreamArgs): ReadableStream {
  const RS = (globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream;
  if (typeof RS === 'undefined') {
    throw new Error(
      '`ReadableStream` is not defined as a global; you will need to polyfill it, e.g. `globalThis.ReadableStream = ReadableStream`.',
    );
  }

  return new RS(...args);
}
