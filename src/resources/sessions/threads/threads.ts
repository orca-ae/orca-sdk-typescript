// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import type { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../../core/pagination';
import { path } from '../../../internal/utils/path';
import type { RequestOptions } from '../../../internal/request-options';
import { Events } from './events';
import type { SessionAgentMember } from '../sessions';
import type { SessionCacheCreationUsage } from '../sessions';

// ---- Session thread response types ----------------------------------------

export type SessionThreadStatus = 'running' | 'idle' | 'rescheduling' | 'terminated';

export interface SessionThreadStats {
  active_seconds?: number;
  duration_seconds?: number;
  startup_seconds?: number;
}

export interface SessionThreadUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: SessionCacheCreationUsage;
}

/**
 * An execution thread within a session. Each session has one primary thread
 * plus zero or more child threads spawned by the coordinator.
 */
export interface SessionThread {
  id: string;
  type: 'session_thread';
  session_id: string;
  /** Agent snapshot at thread creation time. */
  agent: SessionAgentMember;
  /** Parent thread that spawned this thread. Null for the primary thread. */
  parent_thread_id: string | null;
  status: SessionThreadStatus;
  stats: SessionThreadStats | null;
  usage: SessionThreadUsage | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---- Request parameter types ----------------------------------------------

export interface ThreadListParams extends PageCursorParams {
}

// ---- Resource class --------------------------------------------------------

export class Threads extends APIResource {
  /** Per-thread event listing and SSE streaming. */
  events: Events = new Events(this._client);

  /**
   * Retrieve a session thread by ID.
   *
   * @example
   * ```ts
   * const thread = await orca.sessions.threads.retrieve('session_id', 'thread_id');
   * ```
   */
  retrieve(
    sessionId: string,
    threadId: string,
    options?: RequestOptions,
  ): APIPromise<SessionThread> {
    return this._client.get(
      path`/v1/sessions/${sessionId}/threads/${threadId}`,
      { ...options },
    );
  }

  /**
   * List threads attached to a session.
   *
   * @example
   * ```ts
   * const page = await orca.sessions.threads.list('session_id');
   * for await (const thread of orca.sessions.threads.list('session_id')) { ... }
   * ```
   */
  list(
    sessionId: string,
    params: ThreadListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<SessionThread>, SessionThread> {
    return this._client.getAPIList(
      path`/v1/sessions/${sessionId}/threads`,
      PageCursor<SessionThread>,
      { query: params, ...options },
    );
  }

  /**
   * Archive a thread.
   *
   * @example
   * ```ts
   * await orca.sessions.threads.archive('session_id', 'thread_id');
   * ```
   */
  archive(
    sessionId: string,
    threadId: string,
    options?: RequestOptions,
  ): APIPromise<SessionThread> {
    return this._client.post(
      path`/v1/sessions/${sessionId}/threads/${threadId}/archive`,
      { ...options },
    );
  }
}
