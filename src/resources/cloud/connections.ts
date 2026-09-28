// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { cloudGate } from './gate';

export interface ConnectionSecretRef {
  key?: string;
  name?: string;
}

export interface ConnectionGenericAuth {
  clientAuthenticationParameters?: string;
  clientAuthenticationPlugin?: string;
}

export interface ConnectionOAuth2 {
  audience?: string;
  issuerUrl?: string;
  keySecretKey?: string;
  keySecretName?: string;
  scope?: string | null;
}

export interface KafkaPlainAuth {
  passwordKey?: string | null;
  secretName?: string;
  usernameKey?: string | null;
}

export interface KafkaScramAuth extends KafkaPlainAuth {
  hashAlgorithm?: 'SHA-256' | 'SHA-512' | null;
}

export interface KafkaConnectionAuthentication {
  genericAuth?: ConnectionGenericAuth | null;
  oauth2Config?: ConnectionOAuth2 | null;
  plainAuthConfig?: KafkaPlainAuth | null;
  scramAuthConfig?: KafkaScramAuth | null;
}

export interface KafkaKeyStoreConfig {
  fileKey?: string | null;
  keyPasswordKey?: string | null;
  passwordKey?: string | null;
  secretName?: string | null;
  type?: 'JKS' | 'PEM' | 'PKCS12' | null;
}

export interface KafkaTrustStoreConfig {
  fileKey?: string | null;
  passwordKey?: string | null;
  secretName?: string | null;
  type?: 'JKS' | 'PEM' | 'PKCS12' | null;
}

export interface KafkaConnectionTLS {
  enabled?: boolean | null;
  keyStoreConfig?: KafkaKeyStoreConfig | null;
  trustStoreConfig?: KafkaTrustStoreConfig | null;
}

export interface KafkaSchemaRegistryAuthConfig {
  basicAuthConfig?: KafkaPlainAuth | null;
  oauth2Config?: ConnectionOAuth2 | null;
}

export interface KafkaSchemaRegistry {
  authConfig?: KafkaSchemaRegistryAuthConfig | null;
  url?: string | null;
}

export interface KafkaConnection {
  authentication?: KafkaConnectionAuthentication | null;
  bootstrapServers?: string;
  schemaRegistry?: KafkaSchemaRegistry | null;
  tls?: KafkaConnectionTLS | null;
}

export interface OtherConnection {
  endpoint?: string;
  properties?: Record<string, string> | null;
  secretRef?: ConnectionSecretRef | null;
}

export interface PulsarConnectionAuthentication {
  genericAuth?: ConnectionGenericAuth | null;
  oauth2?: ConnectionOAuth2 | null;
  token?: ConnectionSecretRef | null;
}

export interface PulsarConnectionTLS {
  allowInsecureConnection?: boolean | null;
  clientCertSecretRef?: ConnectionSecretRef | null;
  clientKeySecretRef?: ConnectionSecretRef | null;
  enableHostnameVerification?: boolean | null;
  enabled?: boolean | null;
  trustCertsSecretRef?: ConnectionSecretRef | null;
}

export interface PulsarConnection {
  adminUrl?: string | null;
  authentication?: PulsarConnectionAuthentication | null;
  serviceUrl?: string;
  tls?: PulsarConnectionTLS | null;
}

export interface ConnectionSpec {
  kafka?: KafkaConnection | null;
  other?: OtherConnection | null;
  pulsar?: PulsarConnection | null;
  type?: 'pulsar' | 'kafka' | 'other';
}

export interface ConnectionStatusCondition {
  lastTransitionTime?: string;
  message?: string;
  observedGeneration?: number | null;
  reason?: string;
  status?: 'True' | 'False' | 'Unknown';
  type?: string;
}

export interface ConnectionStatus {
  conditions?: ConnectionStatusCondition[] | null;
  lastTestedAt?: string | null;
  message?: string | null;
  observedGeneration?: number | null;
  phase?: 'Unknown' | 'Healthy' | 'Unhealthy' | 'Testing' | null;
}

export interface Connection {
  name?: string;
  spec?: ConnectionSpec;
  status?: ConnectionStatus;
  internal?: boolean;
  clusterRef?: string;
}

export interface ConnectionCreateParams extends Connection {}
export interface ConnectionUpdateParams extends Connection {}
export interface ConnectionValidateParams extends Connection {}

export interface ConnectionHealth {
  name?: string;
  phase?: string;
  healthy?: boolean;
  message?: string;
  lastTestedAt?: string;
}

export class Connections extends APIResource {
  /**
   * List external connections.
   *
   * @example
   * ```ts
   * const connections = await orca.cloud.connections.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<Connection[]> {
    return this._client.get('/apis/cloud.sn.io/v1/connections', cloudGate(this._client, options));
  }

  /**
   * Create an external connection.
   *
   * @example
   * ```ts
   * await orca.cloud.connections.create({ name: 'events', spec: { type: 'kafka' } });
   * ```
   */
  create(params: ConnectionCreateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      '/apis/cloud.sn.io/v1/connections',
      cloudGate(this._client, { body: params, ...options }),
    );
  }

  /**
   * Retrieve an external connection.
   *
   * @example
   * ```ts
   * const connection = await orca.cloud.connections.retrieve('events');
   * ```
   */
  retrieve(name: string, options?: RequestOptions): APIPromise<Connection> {
    return this._client.get(path`/apis/cloud.sn.io/v1/connections/${name}`, cloudGate(this._client, options));
  }

  /**
   * Replace an external connection.
   *
   * @example
   * ```ts
   * await orca.cloud.connections.update('events', { spec: { type: 'kafka' } });
   * ```
   */
  update(name: string, params: ConnectionUpdateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connections/${name}`,
      cloudGate(this._client, { body: params, ...options }),
    );
  }

  /**
   * Delete an external connection.
   *
   * @example
   * ```ts
   * await orca.cloud.connections.delete('events');
   * ```
   */
  delete(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(
      path`/apis/cloud.sn.io/v1/connections/${name}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Test a stored external connection.
   *
   * @example
   * ```ts
   * const health = await orca.cloud.connections.test('events');
   * ```
   */
  test(name: string, options?: RequestOptions): APIPromise<ConnectionHealth> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connections/${name}:test`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Validate an external connection configuration.
   *
   * @example
   * ```ts
   * await orca.cloud.connections.validate({ name: 'events', spec: { type: 'kafka' } });
   * ```
   */
  validate(params: ConnectionValidateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      '/apis/cloud.sn.io/v1/connections/validate',
      cloudGate(this._client, { body: params, ...options }),
    );
  }
}
