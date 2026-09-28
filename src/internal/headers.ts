// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Header parsing and merge utilities.
 *
 * `buildHeaders` accepts every common header shape (plain object, `Headers`,
 * tuple array, previously-built `NullableHeaders`) and merges them with
 * later entries winning. Passing an explicit `null` value clears the
 * matching header — that lets callers turn off defaults set by the client.
 */

import { isReadonlyArray } from './utils/values';

type HeaderValue = string | undefined | null;

export type HeadersLike =
  | Headers
  | readonly HeaderValue[][]
  | Record<string, HeaderValue | readonly HeaderValue[]>
  | undefined
  | null
  | NullableHeaders;

const brand_privateNullableHeaders = Symbol.for('brand.privateNullableHeaders') as symbol & {
  description: 'brand.privateNullableHeaders';
};

/**
 * @internal
 *
 * Internal representation used by the request pipeline. Carries both the
 * concrete header values and a set of names the caller has explicitly
 * cleared (so we can re-suppress defaults at later merge stages).
 */
export type NullableHeaders = {
  /** Brand check; prevent users from forging a `NullableHeaders` literal. */
  [_: typeof brand_privateNullableHeaders]: true;
  /** Parsed headers. */
  values: Headers;
  /** Set of lowercase header names explicitly set to `null`. */
  nulls: Set<string>;
};

function* iterateHeaders(headers: HeadersLike): IterableIterator<readonly [string, string | null]> {
  if (!headers) return;

  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers as NullableHeaders;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }

  let shouldClear = false;
  let iter: Iterable<readonly (HeaderValue | readonly HeaderValue[])[]>;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (const row of iter) {
    const name = row[0];
    if (typeof name !== 'string') throw new TypeError('expected header name to be a string');
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === undefined) continue;

      // Objects (plain records) always overwrite older headers, they never
      // append. Yield a null first to clear the header before re-adding it.
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, null];
      }
      yield [name, value];
    }
  }
}

export const buildHeaders = (newHeaders: HeadersLike[]): NullableHeaders => {
  const targetHeaders = new Headers();
  const nullHeaders = new Set<string>();
  for (const headers of newHeaders) {
    const seenHeaders = new Set<string>();
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (!seenHeaders.has(lowerName)) {
        targetHeaders.delete(lowerName);
        seenHeaders.add(lowerName);
      }
      if (value === null) {
        targetHeaders.delete(lowerName);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};

export const withDefaultAccept = (headers: HeadersLike, accept: string): NullableHeaders => {
  return buildHeaders([{ Accept: accept }, headers]);
};

export const isEmptyHeaders = (headers: HeadersLike): boolean => {
  for (const _ of iterateHeaders(headers)) return false;
  return true;
};
