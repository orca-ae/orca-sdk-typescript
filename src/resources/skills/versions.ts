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

// ---- Skill version types -------------------------------------------------

export interface SkillVersion {
  id: string;
  created_at: string;
  description: string;
  directory: string;
  name: string;
  skill_id: string;
  type: 'skill_version';
  version: string;
}

export interface DeletedSkillVersion {
  id: string;
  type: 'skill_version_deleted';
}

export interface SkillVersionCreateParams {
  files: Uploadable[];
}

export interface SkillVersionListParams extends PageCursorParams {}

// ---- Resource class -------------------------------------------------------

export class Versions extends APIResource {
  /**
   * Create a new version for a skill using multipart/form-data.
   *
   * @example
   * ```ts
   * const version = await orca.skills.versions.create('skill_id', { files: [myFile] });
   * ```
   */
  create(
    skillId: string,
    params: SkillVersionCreateParams,
    options?: RequestOptions,
  ): APIPromise<SkillVersion> {
    return this._client.post(
      path`/v1/skills/${skillId}/versions`,
      multipartFormRequestOptionsPreservingFilePaths({ body: params, ...options }, this._client),
    ) as APIPromise<SkillVersion>;
  }

  /**
   * List versions for a skill.
   *
   * @example
   * ```ts
   * const page = await orca.skills.versions.list('skill_id');
   * for await (const version of orca.skills.versions.list('skill_id')) { ... }
   * ```
   */
  list(
    skillId: string,
    params: SkillVersionListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<SkillVersion>, SkillVersion> {
    return this._client.getAPIList(
      path`/v1/skills/${skillId}/versions`,
      PageCursor<SkillVersion>,
      { query: params, ...options },
    );
  }

  /**
   * Retrieve a specific version of a skill.
   *
   * @example
   * ```ts
   * const version = await orca.skills.versions.retrieve('skill_id', '1.0.0');
   * ```
   */
  retrieve(
    skillId: string,
    version: string,
    options?: RequestOptions,
  ): APIPromise<SkillVersion> {
    return this._client.get(
      path`/v1/skills/${skillId}/versions/${version}`,
      { ...options },
    );
  }

  /**
   * Delete a specific version of a skill.
   *
   * @example
   * ```ts
   * await orca.skills.versions.delete('skill_id', '1.0.0');
   * ```
   */
  delete(
    skillId: string,
    version: string,
    options?: RequestOptions,
  ): APIPromise<DeletedSkillVersion> {
    return this._client.delete(
      path`/v1/skills/${skillId}/versions/${version}`,
      { ...options },
    );
  }
}
