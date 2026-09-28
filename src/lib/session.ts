// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Orca } from '../client';
import type {
  SessionEvent,
  EventListParams,
  EventSendParams,
  EventSendResponse,
  EventStreamParams,
} from '../resources/sessions/events';
import type { DeletedSessionFile, SessionFile, SessionFileListParams } from '../resources/sessions/files';
import type { APIPromise } from '../core/api-promise';
import type { Stream } from '../core/streaming';
import type { PagePromise, PageCursor } from '../core/pagination';
import type { RequestOptions } from '../internal/request-options';
import type {
  ResourceAddParams,
  ResourceListParams,
  ResourceUpdateParams,
  DeletedSessionResource,
  SessionResource,
} from '../resources/sessions/resources';
import type { SessionThread, ThreadListParams } from '../resources/sessions/threads';
import type {
  ThreadEventListParams,
  ThreadEventStreamParams,
} from '../resources/sessions/threads/events';

export interface SessionHandle {
  sessionId: string;
  events: {
    list(
      params?: EventListParams,
      options?: RequestOptions,
    ): PagePromise<PageCursor<SessionEvent>, SessionEvent>;
    send(params: EventSendParams, options?: RequestOptions): APIPromise<EventSendResponse>;
    stream(options?: RequestOptions): APIPromise<Stream<SessionEvent>>;
    stream(params?: EventStreamParams, options?: RequestOptions): APIPromise<Stream<SessionEvent>>;
  };
  resources: {
    list(
      params?: ResourceListParams,
      options?: RequestOptions,
    ): PagePromise<PageCursor<SessionResource>, SessionResource>;
    add(params: ResourceAddParams, options?: RequestOptions): APIPromise<SessionResource>;
    retrieve(resourceId: string, options?: RequestOptions): APIPromise<SessionResource>;
    update(
      resourceId: string,
      params: ResourceUpdateParams,
      options?: RequestOptions,
    ): APIPromise<SessionResource>;
    delete(resourceId: string, options?: RequestOptions): APIPromise<DeletedSessionResource>;
  };
  files: {
    list(
      params?: SessionFileListParams,
      options?: RequestOptions,
    ): PagePromise<PageCursor<SessionFile>, SessionFile>;
    retrieve(fileId: string, options?: RequestOptions): APIPromise<SessionFile>;
    download(fileId: string, options?: RequestOptions): APIPromise<Response>;
    delete(fileId: string, options?: RequestOptions): APIPromise<DeletedSessionFile>;
  };
  threads: {
    list(
      params?: ThreadListParams,
      options?: RequestOptions,
    ): PagePromise<PageCursor<SessionThread>, SessionThread>;
    retrieve(threadId: string, options?: RequestOptions): APIPromise<SessionThread>;
    archive(threadId: string, options?: RequestOptions): APIPromise<SessionThread>;
    events: {
      list(
        threadId: string,
        params?: ThreadEventListParams,
        options?: RequestOptions,
      ): PagePromise<PageCursor<SessionEvent>, SessionEvent>;
      stream(threadId: string, options?: RequestOptions): APIPromise<Stream<SessionEvent>>;
      stream(
        threadId: string,
        params?: ThreadEventStreamParams,
        options?: RequestOptions,
      ): APIPromise<Stream<SessionEvent>>;
    };
  };
}

export function makeSessionHandle(client: Orca, sessionId: string): SessionHandle {
  const streamSession = (
    paramsOrOptions: EventStreamParams | RequestOptions = {},
    options?: RequestOptions,
  ): APIPromise<Stream<SessionEvent>> =>
    client.sessions.events.stream(sessionId, paramsOrOptions as EventStreamParams, options);

  const streamThread = (
    threadId: string,
    paramsOrOptions: ThreadEventStreamParams | RequestOptions = {},
    options?: RequestOptions,
  ): APIPromise<Stream<SessionEvent>> =>
    client.sessions.threads.events.stream(
      sessionId,
      threadId,
      paramsOrOptions as ThreadEventStreamParams,
      options,
    );

  return {
    sessionId,
    events: {
      list: (params, options) => client.sessions.events.list(sessionId, params, options),
      send: (params, options) => client.sessions.events.send(sessionId, params, options),
      stream: streamSession,
    },
    resources: {
      list: (params, options) => client.sessions.resources.list(sessionId, params, options),
      add: (params, options) => client.sessions.resources.add(sessionId, params, options),
      retrieve: (resourceId, options) => client.sessions.resources.retrieve(sessionId, resourceId, options),
      update: (resourceId, params, options) =>
        client.sessions.resources.update(sessionId, resourceId, params, options),
      delete: (resourceId, options) => client.sessions.resources.delete(sessionId, resourceId, options),
    },
    files: {
      list: (params, options) => client.sessions.files.list(sessionId, params, options),
      retrieve: (fileId, options) => client.sessions.files.retrieve(sessionId, fileId, options),
      download: (fileId, options) => client.sessions.files.download(sessionId, fileId, options),
      delete: (fileId, options) => client.sessions.files.delete(sessionId, fileId, options),
    },
    threads: {
      list: (params, options) => client.sessions.threads.list(sessionId, params, options),
      retrieve: (threadId, options) => client.sessions.threads.retrieve(sessionId, threadId, options),
      archive: (threadId, options) => client.sessions.threads.archive(sessionId, threadId, options),
      events: {
        list: (threadId, params, options) =>
          client.sessions.threads.events.list(sessionId, threadId, params, options),
        stream: streamThread,
      },
    },
  };
}
