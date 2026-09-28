// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export type MemoryVersionActor =
  | { type: 'session_actor'; session_id: string }
  | { type: 'api_actor'; api_key_id: string }
  | { type: 'user_actor'; user_id: string };

export interface MemoryVersion {
  id: string;
  created_at: string;
  memory_id: string;
  memory_store_id: string;
  operation: 'created' | 'modified' | 'deleted';
  type: 'memory_version';
  content?: string | null;
  content_sha256?: string | null;
  content_size_bytes?: number | null;
  created_by?: MemoryVersionActor;
  path?: string | null;
  redacted_at?: string | null;
  redacted_by?: MemoryVersionActor;
}

export interface MemoryVersionListParams extends PageCursorParams {
  memory_id?: string;
  api_key_id?: string;
  operation?: 'created' | 'modified' | 'deleted';
  'created_at[gte]'?: string;
  'created_at[lte]'?: string;
  view?: 'basic' | 'full';
}

export interface MemoryVersionRetrieveParams {
  view?: 'basic' | 'full';
}

export class MemoryVersions extends APIResource {
  /**
   * List memory versions in a memory store.
   *
   * @example
   * ```ts
   * for await (const version of orca.memoryStores.memoryVersions.list('store_id')) { ... }
   * ```
   */
  list(
    memoryStoreId: string,
    params: MemoryVersionListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<MemoryVersion>, MemoryVersion> {
    return this._client.getAPIList(
      path`/v1/memory_stores/${memoryStoreId}/memory_versions`,
      PageCursor<MemoryVersion>,
      { query: params, ...options },
    );
  }

  /**
   * Retrieve a memory version.
   *
   * @example
   * ```ts
   * const version = await orca.memoryStores.memoryVersions.retrieve('store_id', 'version_id');
   * ```
   */
  retrieve(
    memoryStoreId: string,
    memoryVersionId: string,
    options?: RequestOptions,
  ): APIPromise<MemoryVersion>;
  retrieve(
    memoryStoreId: string,
    memoryVersionId: string,
    params?: MemoryVersionRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<MemoryVersion>;
  retrieve(
    memoryStoreId: string,
    memoryVersionId: string,
    paramsOrOptions: MemoryVersionRetrieveParams | RequestOptions = {},
    options?: RequestOptions,
  ): APIPromise<MemoryVersion> {
    const hasRetrieveParams = options !== undefined || 'view' in paramsOrOptions;
    const params = hasRetrieveParams ? paramsOrOptions as MemoryVersionRetrieveParams : {};
    const requestOptions = hasRetrieveParams ? options : paramsOrOptions as RequestOptions;

    return this._client.get(
      path`/v1/memory_stores/${memoryStoreId}/memory_versions/${memoryVersionId}`,
      { query: params, ...requestOptions },
    );
  }

  /**
   * Redact a memory version and return the redacted snapshot.
   *
   * @example
   * ```ts
   * const version = await orca.memoryStores.memoryVersions.redact('store_id', 'version_id');
   * ```
   */
  redact(
    memoryStoreId: string,
    memoryVersionId: string,
    options?: RequestOptions,
  ): APIPromise<MemoryVersion> {
    return this._client.post(
      path`/v1/memory_stores/${memoryStoreId}/memory_versions/${memoryVersionId}/redact`,
      { ...options },
    );
  }
}
