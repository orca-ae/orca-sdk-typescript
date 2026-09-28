// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Internal shared types used across the request pipeline.
 *
 * Streaming, upload, and decoder types live next to their implementations.
 */

export type PromiseOrValue<T> = T | Promise<T>;

export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type KeysEnum<T> = { [P in keyof Required<T>]: true };

/**
 * `RequestInit` after the request pipeline has fully merged user/default
 * options and built the final `Headers` instance.
 */
export type FinalizedRequestInit = RequestInit & { headers: Headers };

/**
 * `RequestInit` we accept from callers via `fetchOptions`. We strip the
 * fields the pipeline always overrides so callers can't sneak them past.
 *
 * We keep this loose for now; per-platform extensions (Undici `dispatcher`,
 * Bun-specific keys) can be layered on in a follow-up if/when needed.
 */
export type MergedRequestInit = RequestInit &
  Partial<Record<'body' | 'headers' | 'method' | 'signal', never>>;
