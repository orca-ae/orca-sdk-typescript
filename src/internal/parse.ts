// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Default response parser used by the request pipeline.
 *
 * Behaviour:
 *  - `stream: true` returns a `Stream<unknown>` parsed from the SSE body.
 *    If the caller provides `options.__streamClass`, that class's
 *    `fromSSEResponse` is used instead so typed sub-streams can opt in.
 *  - `204 No Content` -> `null`.
 *  - `__binaryResponse` returns the raw `Response`.
 *  - JSON content types are parsed; everything else returns `text()`.
 */

import { Stream } from '../core/streaming';
import type { FinalRequestOptions } from './request-options';
import { type LoggableClient, formatRequestDetails, loggerFor } from './utils/log';

export type APIResponseProps = {
  response: Response;
  options: FinalRequestOptions;
  controller: AbortController;
  requestLogID: string;
  retryOfRequestLogID: string | undefined;
  startTime: number;
};

/**
 * Minimal interface implemented by `Stream` (and any caller-supplied
 * substream class) so {@link parseStreamResponse} can wire it generically.
 */
interface StreamLike {
  fromSSEResponse(response: Response, controller: AbortController, client?: LoggableClient): unknown;
}

/**
 * Wraps a streaming response in a `Stream<unknown>` (or a caller-supplied
 * substream class via `options.__streamClass`).
 */
export function parseStreamResponse(
  response: Response,
  controller: AbortController,
  client?: LoggableClient,
  streamClass?: unknown,
): unknown {
  if (streamClass && typeof (streamClass as StreamLike).fromSSEResponse === 'function') {
    return (streamClass as StreamLike).fromSSEResponse(response, controller, client);
  }
  return Stream.fromSSEResponse(response, controller, client);
}

export async function parseResponse(
  client: LoggableClient,
  props: APIResponseProps,
): Promise<unknown> {
  const { response, requestLogID, retryOfRequestLogID, startTime, options, controller } = props;

  const body = await (async () => {
    if (options.stream) {
      return parseStreamResponse(response, controller, client, options.__streamClass);
    }

    // fetch refuses to read the body when the status code is 204.
    if (response.status === 204) {
      return null;
    }

    if (options.__binaryResponse) {
      return response;
    }

    const contentType = response.headers.get('content-type');
    const mediaType = contentType?.split(';')[0]?.trim();
    const isJSON = mediaType?.includes('application/json') || mediaType?.endsWith('+json');
    if (isJSON) {
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        return undefined;
      }
      return await response.json();
    }

    return await response.text();
  })();

  loggerFor(client).debug(
    `[${requestLogID}] response parsed`,
    formatRequestDetails({
      retryOfRequestLogID,
      url: response.url,
      status: response.status,
      body,
      durationMs: Date.now() - startTime,
    }),
  );
  return body;
}
