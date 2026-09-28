// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PagePromise } from '../../core/pagination';
import { path } from '../../internal/utils/path';
import type { RequestOptions } from '../../internal/request-options';

export interface SessionResourceBase {
  type: 'file' | 'github_repository' | 'memory_store';
}

export interface SessionResourceCheckout {
  type: 'branch' | 'commit';
}

export interface SessionResourceBranchCheckout extends SessionResourceCheckout {
  type: 'branch';
  name: string;
}

export interface SessionResourceCommitCheckout extends SessionResourceCheckout {
  type: 'commit';
  sha: string;
}

export type SessionResourceCheckoutConfig =
  | SessionResourceBranchCheckout
  | SessionResourceCommitCheckout;

export interface SessionFileResource extends SessionResourceBase {
  id: string;
  type: 'file';
  file_id: string;
  mount_path: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRepositoryResource extends SessionResourceBase {
  id: string;
  type: 'github_repository';
  mount_path: string;
  url: string;
  checkout?: SessionResourceCheckoutConfig | null;
  created_at: string;
  updated_at: string;
}

export interface SessionMemoryStoreResource extends SessionResourceBase {
  type: 'memory_store';
  memory_store_id: string;
  access?: 'read_only' | 'read_write' | null;
  description?: string;
  instructions?: string | null;
  mount_path?: string | null;
  name?: string | null;
}

export type SessionResource =
  | SessionFileResource
  | SessionRepositoryResource
  | SessionMemoryStoreResource;

export interface DeletedSessionResource {
  id: string;
  type: 'session_resource_deleted';
}

export interface SessionResourceRequestBase {
  type: 'file' | 'github_repository' | 'memory_store';
}

export interface FileSessionResourceRequest extends SessionResourceRequestBase {
  type: 'file';
  file_id: string;
  access?: 'read_only' | 'read_write' | null;
  instructions?: string | null;
  mount_path?: string | null;
  mount_strategy?: 'tarball_prefetch';
}

export interface RepositorySessionResourceRequest extends SessionResourceRequestBase {
  type: 'github_repository';
  authorization_token: string;
  url: string;
  access?: 'read_only' | 'read_write' | null;
  checkout?: SessionResourceCheckoutConfig | null;
  instructions?: string | null;
  mount_path?: string | null;
}

export interface MemoryStoreSessionResourceRequest extends SessionResourceRequestBase {
  type: 'memory_store';
  memory_store_id: string;
  access?: 'read_only' | 'read_write' | null;
  instructions?: string | null;
}

export type SessionResourceRequest =
  | FileSessionResourceRequest
  | RepositorySessionResourceRequest
  | MemoryStoreSessionResourceRequest;

export type ResourceAddParams = SessionResourceRequest;

export interface ResourceUpdateParams {
  authorization_token: string;
}

export interface ResourceListParams {
  limit?: number;
  page?: string;
}

export class Resources extends APIResource {
  /**
   * List resources attached to a session.
   */
  list(
    sessionId: string,
    params: ResourceListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<SessionResource>, SessionResource> {
    return this._client.getAPIList(
      path`/v1/sessions/${sessionId}/resources`,
      PageCursor<SessionResource>,
      { query: params, ...options },
    );
  }

  /**
   * Add a resource to a session.
   */
  add(
    sessionId: string,
    params: ResourceAddParams,
    options?: RequestOptions,
  ): APIPromise<SessionResource> {
    return this._client.post(path`/v1/sessions/${sessionId}/resources`, {
      body: params,
      ...options,
    });
  }

  /**
   * Retrieve a session resource by ID.
   */
  retrieve(
    sessionId: string,
    resourceId: string,
    options?: RequestOptions,
  ): APIPromise<SessionResource> {
    return this._client.get(
      path`/v1/sessions/${sessionId}/resources/${resourceId}`,
      { ...options },
    );
  }

  /**
   * Update a session resource. Uses HTTP `POST` per the spec.
   */
  update(
    sessionId: string,
    resourceId: string,
    params: ResourceUpdateParams,
    options?: RequestOptions,
  ): APIPromise<SessionResource> {
    return this._client.post(
      path`/v1/sessions/${sessionId}/resources/${resourceId}`,
      { body: params, ...options },
    );
  }

  /**
   * Remove a resource from a session.
   */
  delete(
    sessionId: string,
    resourceId: string,
    options?: RequestOptions,
  ): APIPromise<DeletedSessionResource> {
    return this._client.delete(
      path`/v1/sessions/${sessionId}/resources/${resourceId}`,
      { ...options },
    );
  }
}
