// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import {
  type Uploadable,
  multipartFormRequestOptionsPreservingFilePaths,
} from '../../internal/uploads';
import * as VersionsAPI from './versions';
import { Versions } from './versions';

// ---- Skill types -----------------------------------------------------------

export interface Skill {
  id: string;
  created_at: string;
  display_title: string | null;
  latest_version: string | null;
  source: 'anthropic' | 'custom';
  type: 'skill';
  updated_at: string;
}

export interface DeletedSkill {
  id: string;
  type: 'skill_deleted';
}

export interface SkillCreateParams {
  files: Uploadable[];
  display_title?: string;
}

export interface SkillListParams extends PageCursorParams {}

// ---- Resource class --------------------------------------------------------

export class Skills extends APIResource {
  /** Skill version management. */
  versions: VersionsAPI.Versions = new Versions(this._client);

  /**
   * Create a new skill using multipart/form-data.
   *
   * @example
   * ```ts
   * const skill = await orca.skills.create({ files: [myFile] });
   * ```
   */
  create(params: SkillCreateParams, options?: RequestOptions): APIPromise<Skill> {
    return this._client.post(
      '/v1/skills',
      multipartFormRequestOptionsPreservingFilePaths({ body: params, ...options }, this._client),
    ) as APIPromise<Skill>;
  }

  /**
   * List skills.
   *
   * @example
   * ```ts
   * const page = await orca.skills.list();
   * for await (const skill of orca.skills.list()) { ... }
   * ```
   */
  list(
    params: SkillListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<Skill>, Skill> {
    return this._client.getAPIList('/v1/skills', PageCursor<Skill>, {
      query: params,
      ...options,
    });
  }

  /**
   * Retrieve a skill by ID.
   *
   * @example
   * ```ts
   * const skill = await orca.skills.retrieve('skill_id');
   * ```
   */
  retrieve(skillId: string, options?: RequestOptions): APIPromise<Skill> {
    return this._client.get(path`/v1/skills/${skillId}`, { ...options });
  }

  /**
   * Delete a skill by ID.
   *
   * @example
   * ```ts
   * await orca.skills.delete('skill_id');
   * ```
   */
  delete(skillId: string, options?: RequestOptions): APIPromise<DeletedSkill> {
    return this._client.delete(path`/v1/skills/${skillId}`, { ...options });
  }
}
