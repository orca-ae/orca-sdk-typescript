// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import type { Agent } from './agents';

export interface VersionListParams extends PageCursorParams {}

export class Versions extends APIResource {
  /**
   * List all historical version snapshots for an agent.
   *
   * @example
   * ```ts
   * const page = await orca.agents.versions.list('agent_id');
   * for await (const snapshot of orca.agents.versions.list('agent_id')) { ... }
   * ```
   */
  list(
    agentId: string,
    params: VersionListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<Agent>, Agent> {
    return this._client.getAPIList(
      path`/v1/agents/${agentId}/versions`,
      PageCursor<Agent>,
      { query: params, ...options },
    );
  }
}
