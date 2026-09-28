// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Byte-level primitives used by the SSE streaming layer.
 *
 * The encoder/decoder are cached on first use to avoid the per-call cost of
 * instantiating `TextEncoder` / `TextDecoder`. They're created lazily so the
 * module is safe to import in environments that don't expose them at module
 * evaluation time (e.g. some bundler test harnesses).
 */

export function concatBytes(buffers: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }

  return output;
}

let encodeUTF8_: ((str: string) => Uint8Array) | undefined;
export function encodeUTF8(str: string): Uint8Array {
  if (!encodeUTF8_) {
    const encoder = new (globalThis as { TextEncoder: typeof TextEncoder }).TextEncoder();
    encodeUTF8_ = encoder.encode.bind(encoder);
  }
  return encodeUTF8_(str);
}

let decodeUTF8_: ((bytes: Uint8Array) => string) | undefined;
export function decodeUTF8(bytes: Uint8Array): string {
  if (!decodeUTF8_) {
    const decoder = new (globalThis as { TextDecoder: typeof TextDecoder }).TextDecoder();
    decodeUTF8_ = decoder.decode.bind(decoder);
  }
  return decodeUTF8_(bytes);
}
