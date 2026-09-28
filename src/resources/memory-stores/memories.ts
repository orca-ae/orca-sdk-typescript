// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export interface Memory {
  id: string;
  content_sha256: string;
  content_size_bytes: number;
  created_at: string;
  memory_store_id: string;
  memory_version_id: string;
  path: string;
  type: 'memory';
  updated_at: string;
  content?: string | null;
}

export interface MemoryPrefix {
  path: string;
  type: 'memory_prefix';
}

export type MemoryListItem = Memory | MemoryPrefix;

export interface DeletedMemory {
  id: string;
  type: 'memory_deleted';
}

export type MemoryView = 'basic' | 'full';

export interface MemoryListParams extends PageCursorParams {
  depth?: 0 | 1 | null;
  path_prefix?: string;
  view?: MemoryView;
}

export interface MemoryCreateBody {
  path: string;
  content: string | null;
}

// `body` keeps the request payload separate from the `view` query parameter.
export interface MemoryCreateParams {
  body: MemoryCreateBody;
  view?: MemoryView;
}

export interface MemoryRetrieveParams {
  view?: MemoryView;
}

export interface MemoryContentSHA256Precondition {
  type: 'content_sha256';
  content_sha256?: string;
}

export interface MemoryUpdateBody {
  content?: string | null;
  path?: string | null;
  precondition?: MemoryContentSHA256Precondition;
}

// `body` keeps request fields separate from query parameters.
export interface MemoryUpdateParams {
  body: MemoryUpdateBody;
  view?: MemoryView;
}

export interface MemoryDeleteParams {
  expected_content_sha256?: string;
}

export class Memories extends APIResource {
  /**
   * List memories in a memory store.
   *
   * @example
   * ```ts
   * for await (const memory of orca.memoryStores.memories.list('store_id')) { ... }
   * ```
   */
  list(
    memoryStoreId: string,
    params: MemoryListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<MemoryListItem>, MemoryListItem> {
    return this._client.getAPIList(
      path`/v1/memory_stores/${memoryStoreId}/memories`,
      PageCursor<MemoryListItem>,
      { query: params, ...options },
    );
  }

  /**
   * Create a memory at a path in a memory store.
   *
   * @example
   * ```ts
   * await orca.memoryStores.memories.create('store_id', {
   *   body: { path: 'notes/todo.md', content: 'Remember this' },
   * });
   * ```
   */
  create(
    memoryStoreId: string,
    params: MemoryCreateParams,
    options?: RequestOptions,
  ): APIPromise<Memory> {
    return this._client.post(path`/v1/memory_stores/${memoryStoreId}/memories`, {
      query: { view: params.view },
      body: params.body,
      ...options,
    });
  }

  /**
   * Retrieve a memory from a memory store.
   *
   * @example
   * ```ts
   * const memory = await orca.memoryStores.memories.retrieve('store_id', 'memory_id');
   * ```
   */
  retrieve(
    memoryStoreId: string,
    memoryId: string,
    params: MemoryRetrieveParams = {},
    options?: RequestOptions,
  ): APIPromise<Memory> {
    return this._client.get(
      path`/v1/memory_stores/${memoryStoreId}/memories/${memoryId}`,
      { query: params, ...options },
    );
  }

  /**
   * Update a memory. The spec uses POST for this update endpoint.
   *
   * @example
   * ```ts
   * await orca.memoryStores.memories.update('store_id', 'memory_id', {
   *   body: { content: 'Updated' },
   * });
   * ```
   */
  update(
    memoryStoreId: string,
    memoryId: string,
    params: MemoryUpdateParams,
    options?: RequestOptions,
  ): APIPromise<Memory> {
    return this._client.post(
      path`/v1/memory_stores/${memoryStoreId}/memories/${memoryId}`,
      {
        query: { view: params.view },
        body: params.body,
        ...options,
      },
    );
  }

  /**
   * Delete a memory, optionally guarded by an expected content hash.
   *
   * @example
   * ```ts
   * await orca.memoryStores.memories.delete('store_id', 'memory_id');
   * ```
   */
  delete(
    memoryStoreId: string,
    memoryId: string,
    params: MemoryDeleteParams = {},
    options?: RequestOptions,
  ): APIPromise<DeletedMemory> {
    return this._client.delete(
      path`/v1/memory_stores/${memoryStoreId}/memories/${memoryId}`,
      {
        query: params,
        ...options,
      },
    );
  }
}
