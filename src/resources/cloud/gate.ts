// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Orca } from '../../client';
import { CLOUD_EXTENSION_GROUP } from '../../internal/constants';
import { withDefaultAccept } from '../../internal/headers';
import type { RequestOptions } from '../../internal/request-options';
import { isAsyncIterable, makeFile, multipartFormRequestOptions } from '../../internal/uploads';

/**
 * Defers `options` until the client confirms this deployment advertises
 * `cloud.sn.io`, throwing `ExtensionNotAvailableError` otherwise.
 *
 * Every `orca.cloud.*` method routes its `RequestOptions` through this
 * instead of calling `this._client.get/post/...` directly. That's enough:
 * `get`, `post`, `put`, `delete`, and `getAPIList` all accept a *promise* of
 * `RequestOptions`, not just a value, so wrapping the options in a gate
 * that resolves after the extension check adds no new request-pipeline
 * plumbing — the existing pipeline already awaits it before building the
 * request.
 *
 * @example
 * ```ts
 * list(options?: RequestOptions): APIPromise<Connection[]> {
 *   return this._client.get('/apis/cloud.sn.io/v1/connections', cloudGate(this._client, options));
 * }
 * ```
 */
export function cloudGate(client: Orca, options?: RequestOptions): Promise<RequestOptions> {
  return client.ensureExtensionAvailable(CLOUD_EXTENSION_GROUP, options).then(() => options ?? {});
}

/** Gate a request whose successful response has no declared content schema. */
export function cloudGateVoid(client: Orca, options?: RequestOptions): Promise<RequestOptions> {
  return cloudGate(client, {
    ...options,
    headers: withDefaultAccept(options?.headers, '*/*'),
  });
}

/** Gate and encode a multipart request to the hosted extension group. */
export function cloudMultipartFormRequestOptions(
  client: Orca,
  body: unknown,
  options?: RequestOptions,
): Promise<RequestOptions> {
  return cloudGate(client, { body, ...options }).then((gated) =>
    multipartFormRequestOptions({ ...gated, body: encodeCloudMultipartBody(gated.body) }, client),
  );
}

function encodeCloudMultipartBody(body: unknown): unknown {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return body;

  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [key, encodeCloudMultipartPart(key, value)]),
  );
}

function encodeCloudMultipartPart(key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Response || isAsyncIterable(value)) return value;

  if (value instanceof Blob) {
    return 'name' in value ? value : makeFile([value], key, { type: value.type });
  }

  return makeFile([JSON.stringify(value)], `${key}.json`, { type: 'application/json' });
}
