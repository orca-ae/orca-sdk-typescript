// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import type { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PagePromise } from '../../../core/pagination';
import { Stream } from '../../../core/streaming';
import { path } from '../../../internal/utils/path';
import type { RequestOptions } from '../../../internal/request-options';
import type { SessionEvent } from '../events';

export interface ThreadEventListParams {
  limit?: number;
  page?: string;
}

export interface ThreadEventStreamParams {
  from_cursor?: string;
  event_deltas?: 'agent.message' | 'agent.thinking' | Array<'agent.message' | 'agent.thinking'>;
}

export class Events extends APIResource {
  /**
   * List events for a specific thread.
   */
  list(
    sessionId: string,
    threadId: string,
    params: ThreadEventListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<SessionEvent>, SessionEvent> {
    return this._client.getAPIList(
      path`/v1/sessions/${sessionId}/threads/${threadId}/events`,
      PageCursor<SessionEvent>,
      { query: params, ...options },
    );
  }

  /**
   * Open an SSE stream for a specific thread. The thread stream is rooted at
   * `/threads/{threadId}/stream` per the spec (not `/events/stream`).
   */
  stream(sessionId: string, threadId: string, options?: RequestOptions): APIPromise<Stream<SessionEvent>>;
  stream(
    sessionId: string,
    threadId: string,
    params?: ThreadEventStreamParams,
    options?: RequestOptions,
  ): APIPromise<Stream<SessionEvent>>;
  stream(
    sessionId: string,
    threadId: string,
    paramsOrOptions: ThreadEventStreamParams | RequestOptions = {},
    options?: RequestOptions,
  ): APIPromise<Stream<SessionEvent>> {
    const hasStreamParams =
      options !== undefined || 'from_cursor' in paramsOrOptions || 'event_deltas' in paramsOrOptions;
    const params = hasStreamParams ? paramsOrOptions as ThreadEventStreamParams : {};
    const requestOptions = hasStreamParams ? options : paramsOrOptions as RequestOptions;

    return this._client.get(
      path`/v1/sessions/${sessionId}/threads/${threadId}/stream`,
      { query: params, ...requestOptions, stream: true },
    ) as APIPromise<Stream<SessionEvent>>;
  }
}
