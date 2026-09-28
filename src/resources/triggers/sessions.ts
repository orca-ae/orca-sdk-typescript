// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import type { Session } from '../sessions';

export interface TriggerSessionListParams extends PageCursorParams {
  include_archived?: boolean | null;
}

/** Sessions produced by a trigger. */
export class Sessions extends APIResource {
  /**
   * List sessions created by a trigger.
   *
   * @example
   * ```ts
   * for await (const session of orca.triggers.sessions.list('trigger_id')) { ... }
   * ```
   */
  list(
    triggerId: string,
    params: TriggerSessionListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<Session>, Session> {
    return this._client.getAPIList(path`/v1/triggers/${triggerId}/sessions`, PageCursor<Session>, {
      query: params,
      ...options,
    });
  }
}
