// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Type aliases for the platform's built-in fetch types.
 *
 * `RequestInit` / `Response` exist as globals in every runtime we target
 * (Node 20+, modern browsers, Deno, Bun, edge workers). `RequestInfo` and
 * `BodyInit` aren't promoted to the global namespace by Node's typings, so
 * we derive them from the `fetch` signature instead — this gives us the
 * right shape in every environment without forcing a `dom` lib import.
 */

export type Fetch = typeof fetch;

/**
 * Options accepted by the `File` constructor and `makeFile` helper.
 *
 * https://developer.mozilla.org/docs/Web/API/File/File#options
 */
export interface FilePropertyBag {
  /** A string indicating the MIME type of the file contents. */
  type?: string;
  /** The last modified time, expressed as the number of milliseconds since epoch. */
  lastModified?: number;
}

/**
 * Alias for the global `RequestInit` type.
 *
 * https://developer.mozilla.org/docs/Web/API/RequestInit
 */
type _RequestInit = NonNullable<Parameters<Fetch>[1]>;

/**
 * Alias for the first argument of `fetch`.
 *
 * https://developer.mozilla.org/docs/Web/API/Window/fetch#resource
 */
type _RequestInfo = Parameters<Fetch>[0];

/**
 * Alias for the global `BodyInit` type — extracted from `RequestInit`.
 *
 * https://developer.mozilla.org/docs/Web/API/RequestInit#body
 */
type _BodyInit = _RequestInit['body'];

/**
 * Alias for the global `Response` type.
 *
 * https://developer.mozilla.org/docs/Web/API/Response
 */
type _Response = Awaited<ReturnType<Fetch>>;

export type {
  _BodyInit as BodyInit,
  _RequestInfo as RequestInfo,
  _RequestInit as RequestInit,
  _Response as Response,
};
