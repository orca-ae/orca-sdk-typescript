// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

// ---- Credential types ------------------------------------------------------

export type VaultCredentialTokenEndpointAuth = {
  type: 'none' | 'client_secret_basic' | 'client_secret_post';
};

export interface VaultCredentialOAuthRefresh {
  token_endpoint: string;
  client_id: string;
  token_endpoint_auth: VaultCredentialTokenEndpointAuth;
  resource?: string | null;
  scope?: string | null;
}

export type VaultCredentialAuth =
  | {
      type: 'static_bearer';
      mcp_server_url: string;
    }
  | {
      type: 'mcp_oauth';
      mcp_server_url: string;
      expires_at?: string | null;
      refresh?: VaultCredentialOAuthRefresh | null;
    }
  | {
      type: 'environment_variable';
      secret_name: string;
      networking: CredentialNetworking;
      injection_location: Required<CredentialInjectionLocation>;
    }
  | {
      type: 'provider';
      provider:
        | 'anthropic'
        | 'openai'
        | 'openai_compatible'
        | 'azure_openai'
        | 'vertex'
        | 'bedrock';
      scheme: 'api_key' | 'bearer' | 'gcp-service-account' | 'aws-sig-v4';
      logical_id: string;
      version: string;
    };

export interface VaultCredential {
  id: string;
  type: 'vault_credential';
  vault_id: string;
  display_name: string | null;
  auth: VaultCredentialAuth;
  metadata: Record<string, string>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeletedVaultCredential {
  id: string;
  type: 'vault_credential_deleted';
}

export type CredentialTokenEndpointAuth =
  | { type: 'none' }
  | { type: 'client_secret_basic'; client_secret: string }
  | { type: 'client_secret_post'; client_secret: string };

export interface CredentialOAuthRefresh {
  refresh_token: string;
  token_endpoint: string;
  client_id: string;
  token_endpoint_auth: CredentialTokenEndpointAuth;
  resource?: string | null;
  scope?: string | null;
}

export type CredentialNetworking =
  | { type: 'limited'; allowed_hosts: string[] }
  | { type: 'unrestricted' };

export interface CredentialInjectionLocation {
  header?: boolean;
  body?: boolean;
}

export type CredentialCreateAuth =
  | {
      type: 'static_bearer';
      token: string;
      mcp_server_url: string;
    }
  | {
      type: 'mcp_oauth';
      access_token: string;
      mcp_server_url: string;
      expires_at?: string | null;
      refresh?: CredentialOAuthRefresh | null;
    }
  | {
      type: 'environment_variable';
      secret_name: string;
      secret_value: string;
      networking: CredentialNetworking;
      injection_location?: CredentialInjectionLocation;
    }
  | {
      type: 'provider';
      provider:
        | 'anthropic'
        | 'openai'
        | 'openai_compatible'
        | 'azure_openai'
        | 'vertex'
        | 'bedrock';
      scheme: 'api_key' | 'bearer' | 'gcp-service-account' | 'aws-sig-v4';
      logical_id: string;
      secret_value: string;
    };

export interface CredentialCreateParams {
  display_name?: string | null;
  auth: CredentialCreateAuth;
  metadata?: Record<string, string>;
}

export type CredentialUpdateTokenEndpointAuth =
  | { type: 'client_secret_basic'; client_secret?: string | null }
  | { type: 'client_secret_post'; client_secret?: string | null };

export interface CredentialUpdateOAuthRefresh {
  refresh_token?: string | null;
  scope?: string | null;
  token_endpoint_auth?: CredentialUpdateTokenEndpointAuth;
}

export type CredentialUpdateAuth =
  | {
      type: 'static_bearer';
      token?: string | null;
    }
  | {
      type: 'mcp_oauth';
      access_token?: string | null;
      expires_at?: string | null;
      refresh?: CredentialUpdateOAuthRefresh | null;
    }
  | {
      type: 'environment_variable';
      injection_location?: CredentialInjectionLocation;
      networking?: CredentialNetworking | null;
      secret_value?: string | null;
    }
  | {
      type: 'provider';
      logical_id?: string;
      secret_value?: string | null;
    };

export interface CredentialUpdateParams {
  display_name?: string | null;
  auth?: CredentialUpdateAuth;
  metadata?: Record<string, string | null> | null;
}

export interface CredentialListParams extends PageCursorParams {
  include_archived?: boolean;
}

export interface CredentialValidationHTTPResponse {
  status_code: number;
  content_type: string;
  body: string;
  body_truncated: boolean;
}

export interface CredentialValidationMCPProbe {
  method: 'initialize';
  http_response: CredentialValidationHTTPResponse | null;
}

export interface CredentialValidationRefresh {
  status: 'succeeded' | 'connect_error' | 'failed' | 'no_refresh_token';
  http_response: CredentialValidationHTTPResponse | null;
}

export interface CredentialValidation {
  type: 'vault_credential_validation';
  credential_id: string;
  vault_id: string;
  validated_at: string;
  has_refresh_token: boolean;
  status: 'valid' | 'invalid' | 'unknown';
  mcp_probe: CredentialValidationMCPProbe;
  refresh: CredentialValidationRefresh;
}

// ---- Resource class --------------------------------------------------------

export class Credentials extends APIResource {
  /**
   * List credentials in a vault.
   *
   * @example
   * ```ts
   * const page = await orca.vaults.credentials.list('vault_id');
   * for await (const credential of orca.vaults.credentials.list('vault_id')) { ... }
   * ```
   */
  list(
    vaultId: string,
    params: CredentialListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<VaultCredential>, VaultCredential> {
    return this._client.getAPIList(
      path`/v1/vaults/${vaultId}/credentials`,
      PageCursor<VaultCredential>,
      { query: params, ...options },
    );
  }

  /**
   * Create a new credential in a vault.
   *
   * @example
   * ```ts
   * const credential = await orca.vaults.credentials.create('vault_id', {
   *   display_name: 'My Credential',
   *   auth: {
   *     type: 'static_bearer',
   *     token: process.env.MCP_TOKEN!,
   *     mcp_server_url: 'https://mcp.example.com',
   *   },
   * });
   * ```
   */
  create(
    vaultId: string,
    params: CredentialCreateParams,
    options?: RequestOptions,
  ): APIPromise<VaultCredential> {
    return this._client.post(path`/v1/vaults/${vaultId}/credentials`, {
      body: params,
      ...options,
    });
  }

  /**
   * Retrieve a credential from a vault.
   *
   * @example
   * ```ts
   * const credential = await orca.vaults.credentials.retrieve('vault_id', 'credential_id');
   * ```
   */
  retrieve(
    vaultId: string,
    credentialId: string,
    options?: RequestOptions,
  ): APIPromise<VaultCredential> {
    return this._client.get(
      path`/v1/vaults/${vaultId}/credentials/${credentialId}`,
      { ...options },
    );
  }

  /**
   * Update a credential. Uses HTTP `POST` per the spec.
   *
   * @example
   * ```ts
   * await orca.vaults.credentials.update('vault_id', 'credential_id', { display_name: 'New' });
   * ```
   */
  update(
    vaultId: string,
    credentialId: string,
    params: CredentialUpdateParams,
    options?: RequestOptions,
  ): APIPromise<VaultCredential> {
    return this._client.post(
      path`/v1/vaults/${vaultId}/credentials/${credentialId}`,
      { body: params, ...options },
    );
  }

  /**
   * Delete a credential from a vault.
   *
   * @example
   * ```ts
   * await orca.vaults.credentials.delete('vault_id', 'credential_id');
   * ```
   */
  delete(
    vaultId: string,
    credentialId: string,
    options?: RequestOptions,
  ): APIPromise<DeletedVaultCredential> {
    return this._client.delete(
      path`/v1/vaults/${vaultId}/credentials/${credentialId}`,
      { ...options },
    );
  }

  /**
   * Archive a credential.
   *
   * @example
   * ```ts
   * await orca.vaults.credentials.archive('vault_id', 'credential_id');
   * ```
   */
  archive(
    vaultId: string,
    credentialId: string,
    options?: RequestOptions,
  ): APIPromise<VaultCredential> {
    return this._client.post(
      path`/v1/vaults/${vaultId}/credentials/${credentialId}/archive`,
      { ...options },
    );
  }

  /**
   * Validate a credential's MCP OAuth configuration.
   *
   * @example
   * ```ts
   * const result = await orca.vaults.credentials.validate('vault_id', 'credential_id');
   * ```
   */
  validate(
    vaultId: string,
    credentialId: string,
    options?: RequestOptions,
  ): APIPromise<CredentialValidation> {
    return this._client.post(
      path`/v1/vaults/${vaultId}/credentials/${credentialId}/mcp_oauth_validate`,
      { ...options },
    );
  }
}
