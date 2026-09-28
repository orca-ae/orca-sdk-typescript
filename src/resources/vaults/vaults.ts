// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import * as CredentialsAPI from './credentials';
import { Credentials } from './credentials';

// ---- Vault types -----------------------------------------------------------

export interface Vault {
  id: string;
  type: 'vault';
  display_name: string;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface DeletedVault {
  id: string;
  type: 'vault_deleted';
}

export interface VaultCreateParams {
  display_name: string;
  metadata?: Record<string, string>;
}

export interface VaultUpdateParams {
  display_name?: string | null;
  metadata?: Record<string, string | null> | null;
}

export interface VaultListParams extends PageCursorParams {
  include_archived?: boolean;
}

// ---- Resource class --------------------------------------------------------

export class Vaults extends APIResource {
  /** Credential management for a vault. */
  credentials: CredentialsAPI.Credentials = new Credentials(this._client);

  /**
   * Create a new vault.
   *
   * @example
   * ```ts
   * const vault = await orca.vaults.create({ display_name: 'My Vault' });
   * ```
   */
  create(params: VaultCreateParams, options?: RequestOptions): APIPromise<Vault> {
    return this._client.post('/v1/vaults', { body: params, ...options });
  }

  /**
   * Retrieve a vault by ID.
   *
   * @example
   * ```ts
   * const vault = await orca.vaults.retrieve('vault_id');
   * ```
   */
  retrieve(vaultId: string, options?: RequestOptions): APIPromise<Vault> {
    return this._client.get(path`/v1/vaults/${vaultId}`, { ...options });
  }

  /**
   * Update a vault.
   *
   * @example
   * ```ts
   * const vault = await orca.vaults.update('vault_id', { display_name: 'New Name' });
   * ```
   */
  update(vaultId: string, params: VaultUpdateParams, options?: RequestOptions): APIPromise<Vault> {
    return this._client.post(path`/v1/vaults/${vaultId}`, {
      body: params,
      ...options,
    });
  }

  /**
   * List vaults, optionally including archived vaults or filtering by creation time.
   *
   * @example
   * ```ts
   * const page = await orca.vaults.list();
   * for await (const vault of orca.vaults.list()) { ... }
   * ```
   */
  list(
    params: VaultListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<Vault>, Vault> {
    return this._client.getAPIList('/v1/vaults', PageCursor<Vault>, {
      query: params,
      ...options,
    });
  }

  /**
   * Delete a vault by ID.
   *
   * @example
   * ```ts
   * await orca.vaults.delete('vault_id');
   * ```
   */
  delete(vaultId: string, options?: RequestOptions): APIPromise<DeletedVault> {
    return this._client.delete(path`/v1/vaults/${vaultId}`, { ...options });
  }

  /**
   * Archive a vault.
   *
   * @example
   * ```ts
   * await orca.vaults.archive('vault_id');
   * ```
   */
  archive(vaultId: string, options?: RequestOptions): APIPromise<Vault> {
    return this._client.post(path`/v1/vaults/${vaultId}/archive`, {
      ...options,
    });
  }
}
