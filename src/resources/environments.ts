// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../core/pagination';
import type { RequestOptions } from '../internal/request-options';
import { path } from '../internal/utils/path';

// ---- Environment response type -----------------------------------------------

export interface Environment {
  id: string;
  type: 'environment';
  name: string;
  description: string;
  config: EnvironmentResponseConfig;
  metadata: Record<string, string>;
  scope?: 'organization' | 'account';
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface DeletedEnvironment {
  id: string;
  type: 'environment_deleted';
}

// ---- Request parameter types -------------------------------------------------

export interface EnvironmentPackages {
  type?: 'packages';
  apt?: string[] | null;
  cargo?: string[] | null;
  gem?: string[] | null;
  go?: string[] | null;
  npm?: string[] | null;
  pip?: string[] | null;
}

export interface EnvironmentLimitedNetworking {
  type: 'limited';
  allowed_hosts?: string[] | null;
  allow_mcp_servers?: boolean | null;
  allow_package_managers?: boolean | null;
  [key: string]: unknown;
}

export interface EnvironmentUnrestrictedNetworking {
  type: 'unrestricted';
  [key: string]: unknown;
}

export type EnvironmentNetworking =
  | EnvironmentLimitedNetworking
  | EnvironmentUnrestrictedNetworking;

interface EnvironmentConfigFields {
  packages?: EnvironmentPackages | null;
  networking?: EnvironmentNetworking | null;
}

export interface EnvironmentCloudConfig extends EnvironmentConfigFields {
  type?: 'cloud';
}

export interface EnvironmentSelfHostedConfig extends EnvironmentConfigFields {
  type: 'self_hosted';
}

export type EnvironmentConfig = EnvironmentCloudConfig | EnvironmentSelfHostedConfig;

export interface EnvironmentResponsePackages {
  type: 'packages';
  apt: string[];
  cargo: string[];
  gem: string[];
  go: string[];
  npm: string[];
  pip: string[];
}

export interface EnvironmentResponseLimitedNetworking {
  type: 'limited';
  allowed_hosts?: string[] | null;
  allow_mcp_servers?: boolean | null;
  allow_package_managers?: boolean | null;
}

export interface EnvironmentResponseUnrestrictedNetworking {
  type: 'unrestricted';
}

export type EnvironmentResponseNetworking =
  | EnvironmentResponseLimitedNetworking
  | EnvironmentResponseUnrestrictedNetworking;

export interface EnvironmentResponseCloudConfig {
  type: 'cloud';
  packages: EnvironmentResponsePackages;
  networking: EnvironmentResponseNetworking;
}

export interface EnvironmentResponseSelfHostedConfig {
  type: 'self_hosted';
}

export type EnvironmentResponseConfig =
  | EnvironmentResponseCloudConfig
  | EnvironmentResponseSelfHostedConfig;

export interface EnvironmentCreateParams {
  name: string;
  description?: string | null;
  config?: EnvironmentConfig | null;
  metadata?: Record<string, string>;
  scope?: 'organization' | 'account' | null;
}

export interface EnvironmentUpdateParams {
  name?: string | null;
  description?: string | null;
  config?: EnvironmentConfig | null;
  metadata?: Record<string, string | null>;
  scope?: 'organization' | 'account' | null;
}

export interface EnvironmentListParams extends PageCursorParams {
  include_archived?: boolean;
}

// ---- Resource class ----------------------------------------------------------

export class Environments extends APIResource {
  /**
   * Create a new environment in the registry.
   *
   * @example
   * ```ts
   * const env = await orca.environments.create({ name: 'production' });
   * ```
   */
  create(params: EnvironmentCreateParams, options?: RequestOptions): APIPromise<Environment> {
    return this._client.post('/v1/environments', { body: params, ...options });
  }

  /**
   * Retrieve an environment by ID.
   *
   * @example
   * ```ts
   * const env = await orca.environments.retrieve('env_id');
   * ```
   */
  retrieve(envId: string, options?: RequestOptions): APIPromise<Environment> {
    return this._client.get(path`/v1/environments/${envId}`, { ...options });
  }

  /**
   * Update an existing environment.
   *
   * @example
   * ```ts
   * const env = await orca.environments.update('env_id', { name: 'staging' });
   * ```
   */
  update(
    envId: string,
    params: EnvironmentUpdateParams,
    options?: RequestOptions,
  ): APIPromise<Environment> {
    return this._client.post(path`/v1/environments/${envId}`, {
      body: params,
      ...options,
    });
  }

  /**
   * List environments, optionally including archived environments.
   *
   * @example
   * ```ts
   * const page = await orca.environments.list();
   * for await (const env of orca.environments.list()) { ... }
   * ```
   */
  list(
    params: EnvironmentListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<Environment>, Environment> {
    return this._client.getAPIList('/v1/environments', PageCursor<Environment>, {
      query: params,
      ...options,
    });
  }

  /**
   * Permanently delete an environment.
   *
   * @example
   * ```ts
   * await orca.environments.delete('env_id');
   * ```
   */
  delete(envId: string, options?: RequestOptions): APIPromise<DeletedEnvironment> {
    return this._client.delete(path`/v1/environments/${envId}`, { ...options });
  }

  /**
   * Archive (soft-delete) an environment.
   *
   * @example
   * ```ts
   * await orca.environments.archive('env_id');
   * ```
   */
  archive(envId: string, options?: RequestOptions): APIPromise<Environment> {
    return this._client.post(path`/v1/environments/${envId}/archive`, {
      ...options,
    });
  }
}
