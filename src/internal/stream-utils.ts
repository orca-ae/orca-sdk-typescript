// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Cross-runtime helpers for consuming `ReadableStream` bodies.
 *
 * Browsers and Node's `undici`-backed fetch don't yet expose
 * `Symbol.asyncIterator` on `ReadableStream`. This polyfill follows the
 * pattern from
 * https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 * so we can `for await ... of` a stream regardless of runtime.
 */

export function ReadableStreamToAsyncIterable<T>(stream: any): AsyncIterableIterator<T> {
  if (stream[Symbol.asyncIterator]) return stream;

  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done) reader.releaseLock(); // release lock when stream becomes closed
        return result;
      } catch (e) {
        reader.releaseLock(); // release lock when stream becomes errored
        throw e;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
