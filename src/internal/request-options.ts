// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Request option types used by both the caller-facing helpers and the
 * internal pipeline.
 *
 * `__streamClass` is typed loosely so this module doesn't depend on how
 * `Stream` is implemented; the response parser (`parse.ts`) consumes it.
 * Bodies that aren't already binary, form, stream or iterable data fall back
 * to the JSON encoder below.
 */

import type { BodyInit } from './builtin-types';
import { type HeadersLike, type NullableHeaders } from './headers';
import type { HTTPMethod, MergedRequestInit } from './types';

/**
 * Loose type for the streaming class carried in `__streamClass`, so
 * `request-options.ts` doesn't need to know how `Stream` is implemented.
 */
export type StreamClassPlaceholder = unknown;

export type FinalRequestOptions = RequestOptions & { method: HTTPMethod; path: string };

export type RequestOptions = {
  /** The HTTP method for the request (e.g., 'get', 'post', 'put', 'delete'). */
  method?: HTTPMethod;

  /**
   * The URL path for the request.
   *
   * @example "/v1/agents"
   */
  path?: string;

  /** Query parameters to include in the request URL. */
  query?: object | undefined | null;

  /** The request body. Can be a string, JSON object, FormData, or other supported types. */
  body?: unknown;

  /** HTTP headers to include with the request. */
  headers?: HeadersLike;

  /**
   * Maximum number of retries on transient failures (network error, 5XX, etc.).
   *
   * @default 2
   */
  maxRetries?: number;

  /** When true, parse the response as a Server-Sent Events stream. */
  stream?: boolean | undefined;

  /**
   * Per-request timeout in milliseconds. Defaults to the client-level setting.
   *
   * @unit milliseconds
   */
  timeout?: number;

  /**
   * Additional `RequestInit` options merged into the underlying `fetch` call.
   */
  fetchOptions?: MergedRequestInit;

  /** An `AbortSignal` that can be used to cancel the request. */
  signal?: AbortSignal | undefined | null;

  /** A unique key for this request to enable idempotency. */
  idempotencyKey?: string;

  /** Override the client-level base URL for a single request. */
  defaultBaseURL?: string | undefined;

  /** When true, the parser returns the raw `Response` instead of decoding it. */
  __binaryResponse?: boolean | undefined;

  /** Overrides the streaming class used when `stream: true`. */
  __streamClass?: StreamClassPlaceholder;
};

export type EncodedContent = { bodyHeaders: HeadersLike; body: BodyInit };
export type RequestEncoder = (request: { headers: NullableHeaders; body: unknown }) => EncodedContent;

/**
 * Default JSON encoder, used for request bodies that aren't already binary,
 * form, stream or iterable data.
 */
export const FallbackEncoder: RequestEncoder = ({ body }) => {
  return {
    bodyHeaders: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
};
