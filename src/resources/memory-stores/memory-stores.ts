// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../core/pagination';
import { path } from '../../internal/utils/path';
import type { RequestOptions } from '../../internal/request-options';
import * as MemoriesAPI from './memories';
import { Memories } from './memories';
import * as MemoryVersionsAPI from './memory-versions';
import { MemoryVersions } from './memory-versions';

// ---- Memory store types ----------------------------------------------------

/**
 * A `memory_store`: a named container for agent memories, scoped to a workspace.
 * Attach a store to a session via `resources[]` to mount it as a directory the
 * agent can read and write.
 */
export interface MemoryStore {
  id: string;
  type: 'memory_store';
  name: string;
  description?: string;
  metadata?: Record<string, string>;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface DeletedMemoryStore {
  id: string;
  type: 'memory_store_deleted';
}

// ---- Request parameter types ----------------------------------------------

export interface MemoryStoreCreateParams {
  /** Human-readable name; 1–255 characters. */
  name: string;
  /** Free-text description, up to 1024 characters. */
  description?: string;
  /** Arbitrary key-value tags; up to 16 pairs. */
  metadata?: Record<string, string>;
}

export interface MemoryStoreUpdateParams {
  name?: string | null;
  description?: string | null;
  /** Metadata patch. Set a key to `null` to delete it; omit to preserve. */
  metadata?: Record<string, string | null> | null;
}

export interface MemoryStoreListParams extends PageCursorParams {
  include_archived?: boolean;
}

// ---- Resource class --------------------------------------------------------

export class MemoryStores extends APIResource {
  /** Memories contained in a memory store. */
  memories: MemoriesAPI.Memories = new Memories(this._client);

  /** Historical memory versions in a memory store. */
  memoryVersions: MemoryVersionsAPI.MemoryVersions = new MemoryVersions(this._client);

  /**
   * Create a new memory store.
   *
   * @example
   * ```ts
   * const store = await orca.memoryStores.create({ name: 'project-notes' });
   * ```
   */
  create(params: MemoryStoreCreateParams, options?: RequestOptions): APIPromise<MemoryStore> {
    return this._client.post('/v1/memory_stores', { body: params, ...options });
  }

  /**
   * Retrieve a memory store by ID.
   */
  retrieve(memoryStoreId: string, options?: RequestOptions): APIPromise<MemoryStore> {
    return this._client.get(path`/v1/memory_stores/${memoryStoreId}`, {
      ...options,
    });
  }

  /**
   * Update a memory store.
   */
  update(
    memoryStoreId: string,
    params: MemoryStoreUpdateParams,
    options?: RequestOptions,
  ): APIPromise<MemoryStore> {
    return this._client.post(path`/v1/memory_stores/${memoryStoreId}`, {
      body: params,
      ...options,
    });
  }

  /**
   * List memory stores.
   */
  list(
    params: MemoryStoreListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<MemoryStore>, MemoryStore> {
    return this._client.getAPIList('/v1/memory_stores', PageCursor<MemoryStore>, {
      query: params,
      ...options,
    });
  }

  /**
   * Delete a memory store.
   */
  delete(memoryStoreId: string, options?: RequestOptions): APIPromise<DeletedMemoryStore> {
    return this._client.delete(path`/v1/memory_stores/${memoryStoreId}`, { ...options });
  }

  /**
   * Archive a memory store.
   */
  archive(memoryStoreId: string, options?: RequestOptions): APIPromise<MemoryStore> {
    return this._client.post(
      path`/v1/memory_stores/${memoryStoreId}/archive`,
      { ...options },
    );
  }
}
