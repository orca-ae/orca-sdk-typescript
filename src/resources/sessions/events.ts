// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PagePromise } from '../../core/pagination';
import { Stream } from '../../core/streaming';
import { path } from '../../internal/utils/path';
import type { RequestOptions } from '../../internal/request-options';

export interface SessionEvent {
  id: string;
  type: string;
  processed_at?: string | null;
  [key: string]: unknown;
}

export interface EventListParams {
  limit?: number;
  page?: string;
  'created_at[gt]'?: string;
  'created_at[gte]'?: string;
  'created_at[lt]'?: string;
  'created_at[lte]'?: string;
  order?: 'asc' | 'desc';
  types?: string | string[];
  subpath?: string;
}

export interface EventStreamParams {
  from_cursor?: string;
  subpath?: string;
  event_deltas?: 'agent.message' | 'agent.thinking' | ('agent.message' | 'agent.thinking')[];
}

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface Base64ContentSource {
  type: 'base64';
  media_type: string;
  data: string;
}

export interface URLContentSource {
  type: 'url';
  url: string;
}

export interface FileContentSource {
  type: 'file';
  file_id: string;
}

export interface TextDocumentSource {
  type: 'text';
  data: string;
  media_type?: string;
  [key: string]: unknown;
}

export type BinaryContentSource = Base64ContentSource | URLContentSource | FileContentSource;

export interface ImageContentBlock {
  type: 'image';
  source: BinaryContentSource;
  [key: string]: unknown;
}

export interface DocumentContentBlock {
  type: 'document';
  source: BinaryContentSource | TextDocumentSource;
  context?: string | null;
  title?: string | null;
}

export interface SearchResultContentBlock {
  type: 'search_result';
  [key: string]: unknown;
}

export type MessageContentBlock = TextContentBlock | ImageContentBlock | DocumentContentBlock;
export type ToolResultContentBlock = MessageContentBlock | SearchResultContentBlock;
export type NonEmptyArray<T> = [T, ...T[]];

export interface SessionUserMessageEventInput {
  type: 'user.message';
  content: NonEmptyArray<MessageContentBlock>;
}

export interface SessionInterruptEventInput {
  type: 'user.interrupt';
  session_thread_id?: string | null;
}

export interface SessionToolConfirmationEventInput {
  type: 'user.tool_confirmation';
  tool_use_id: string;
  result: 'allow' | 'deny';
  deny_message?: string | null;
}

export interface SessionCustomToolResultEventInput {
  type: 'user.custom_tool_result';
  custom_tool_use_id: string;
  content?: ToolResultContentBlock[];
  is_error?: boolean | null;
}

export type OutcomeRubric =
  | { type: 'text'; content: string }
  | { type: 'file'; file_id: string };

export interface SessionDefineOutcomeEventInput {
  type: 'user.define_outcome';
  description: string;
  rubric: OutcomeRubric;
  max_iterations?: number | null;
}

export interface SessionToolResultEventInput {
  type: 'user.tool_result';
  tool_use_id: string;
  content?: ToolResultContentBlock[];
  is_error?: boolean | null;
}

export interface SessionSystemMessageEventInput {
  type: 'system.message';
  content: NonEmptyArray<TextContentBlock>;
}

export type SessionEventInput =
  | SessionUserMessageEventInput
  | SessionInterruptEventInput
  | SessionToolConfirmationEventInput
  | SessionCustomToolResultEventInput
  | SessionDefineOutcomeEventInput
  | SessionToolResultEventInput
  | SessionSystemMessageEventInput;

export interface EventSendParams {
  events: SessionEventInput[];
}

export interface EventSendResponse {
  data?: SessionEvent[];
}

export class Events extends APIResource {
  /**
   * List persisted events for a session.
   *
   * @example
   * ```ts
   * for await (const event of orca.sessions.events.list('session_id')) { ... }
   * ```
   */
  list(
    sessionId: string,
    params: EventListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<SessionEvent>, SessionEvent> {
    return this._client.getAPIList(
      path`/v1/sessions/${sessionId}/events`,
      PageCursor<SessionEvent>,
      { query: params, ...options },
    );
  }

  /**
   * Send one or more events to a session.
   *
   * @example
   * ```ts
   * await orca.sessions.events.send('session_id', {
   *   events: [{ type: 'user.message', content: [{ type: 'text', text: 'Hello' }] }],
   * });
   * ```
   */
  send(
    sessionId: string,
    params: EventSendParams,
    options?: RequestOptions,
  ): APIPromise<EventSendResponse> {
    return this._client.post(path`/v1/sessions/${sessionId}/events`, {
      body: params,
      ...options,
    });
  }

  /**
   * Open an SSE stream of events for a session.
   *
   * @example
   * ```ts
   * const stream = await orca.sessions.events.stream('session_id', {
   *   from_cursor: 'evt_previous',
   * });
   * for await (const event of stream) { ... }
   * ```
   */
  stream(sessionId: string, options?: RequestOptions): APIPromise<Stream<SessionEvent>>;
  stream(
    sessionId: string,
    params?: EventStreamParams,
    options?: RequestOptions,
  ): APIPromise<Stream<SessionEvent>>;
  stream(
    sessionId: string,
    paramsOrOptions: EventStreamParams | RequestOptions = {},
    options?: RequestOptions,
  ): APIPromise<Stream<SessionEvent>> {
    const hasStreamParams =
      options !== undefined ||
      'from_cursor' in paramsOrOptions ||
      'subpath' in paramsOrOptions ||
      'event_deltas' in paramsOrOptions;
    const params = hasStreamParams ? paramsOrOptions as EventStreamParams : {};
    const requestOptions = hasStreamParams ? options : paramsOrOptions as RequestOptions;

    return this._client.get(path`/v1/sessions/${sessionId}/events/stream`, {
      query: params,
      ...requestOptions,
      stream: true,
    }) as APIPromise<Stream<SessionEvent>>;
  }
}
