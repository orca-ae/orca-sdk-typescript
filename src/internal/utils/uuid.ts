// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Generates a v4 UUID. Used by the request pipeline to mint idempotency keys
 * and trace IDs.
 *
 * Prefers `crypto.randomUUID()` (Node 14.17+, modern browsers, Deno, Bun).
 * Falls back to a `Math.random` based implementation — acceptable for
 * idempotency keys, which only need to be unique per caller within a short
 * retry window.
 */

// https://stackoverflow.com/a/2117523
export let uuid4 = function (): string {
  const { crypto } = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (crypto?.randomUUID) {
    uuid4 = crypto.randomUUID.bind(crypto);
    return crypto.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte =
    crypto?.getRandomValues ?
      () => crypto.getRandomValues!(u8)[0]!
    : () => (Math.random() * 0xff) & 0xff;
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (+c ^ (randomByte() & (15 >> (+c / 4)))).toString(16),
  );
};
