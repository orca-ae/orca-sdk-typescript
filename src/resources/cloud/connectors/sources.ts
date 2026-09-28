// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import type { APIPromise } from '../../../core/api-promise';
import type { RequestOptions } from '../../../internal/request-options';
import type { Uploadable } from '../../../internal/uploads';
import { path } from '../../../internal/utils/path';
import { cloudGate, cloudGateVoid, cloudMultipartFormRequestOptions } from '../gate';
import type {
  ProducerConfig,
  RuntimeExceptionInformation,
  RuntimeResources,
  RuntimeUpdateOptions,
} from '../runtime-types';

export interface BatchSourceConfig {
  discoveryTriggererClassName?: string;
  discoveryTriggererConfig?: Record<string, Record<string, unknown>>;
}

export interface SourceConfig {
  tenant?: string;
  namespace?: string;
  name?: string;
  className?: string;
  topicName?: string;
  producerConfig?: ProducerConfig;
  serdeClassName?: string;
  schemaType?: string;
  configs?: Record<string, Record<string, unknown>>;
  secrets?: Record<string, Record<string, unknown>>;
  parallelism?: number;
  processingGuarantees?: 'ATLEAST_ONCE' | 'ATMOST_ONCE' | 'EFFECTIVELY_ONCE' | 'MANUAL';
  resources?: RuntimeResources;
  sourceType?: string;
  archive?: string;
  runtimeFlags?: string;
  customRuntimeOptions?: string;
  batchSourceConfig?: BatchSourceConfig;
  batchBuilder?: string;
  logTopic?: string;
  connection?: string;
  snServiceAccount?: string;
}

export interface SourceCreateParams {
  data?: Uploadable;
  url?: string;
  sourceConfig?: SourceConfig;
}

export interface SourceUpdateParams extends SourceCreateParams {
  updateOptions?: RuntimeUpdateOptions;
}

export interface SourceInstanceStatus {
  running?: boolean;
  error?: string;
  numRestarts?: number;
  numReceivedFromSource?: number;
  numSystemExceptions?: number;
  latestSystemExceptions?: RuntimeExceptionInformation[];
  numSourceExceptions?: number;
  latestSourceExceptions?: RuntimeExceptionInformation[];
  numWritten?: number;
  lastReceivedTime?: number;
  workerId?: string;
}

export interface SourceStatusInstance {
  instanceId?: number;
  status?: SourceInstanceStatus;
}

export interface SourceStatus {
  numInstances?: number;
  numRunning?: number;
  instances?: SourceStatusInstance[];
}

export class SourceConnectors extends APIResource {
  /**
   * Register a source connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.create('events', { url: 'source://events@latest' });
   * ```
   */
  create(name: string, params: SourceCreateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Retrieve a source connector configuration.
   *
   * @example
   * ```ts
   * const source = await orca.cloud.connectors.sources.retrieve('events');
   * ```
   */
  retrieve(name: string, options?: RequestOptions): APIPromise<SourceConfig> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Update a source connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.update('events', { sourceConfig: { parallelism: 2 } });
   * ```
   */
  update(name: string, params: SourceUpdateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Deregister a source connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.delete('events');
   * ```
   */
  delete(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Retrieve status for one source connector instance.
   *
   * @example
   * ```ts
   * const status = await orca.cloud.connectors.sources.retrieveInstanceStatus('events', '0');
   * ```
   */
  retrieveInstanceStatus(
    name: string,
    instanceId: string,
    options?: RequestOptions,
  ): APIPromise<SourceInstanceStatus> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}/${instanceId}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve aggregate source connector status.
   *
   * @example
   * ```ts
   * const status = await orca.cloud.connectors.sources.retrieveStatus('events');
   * ```
   */
  retrieveStatus(name: string, options?: RequestOptions): APIPromise<SourceStatus> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * List source connector names.
   *
   * @example
   * ```ts
   * const sources = await orca.cloud.connectors.sources.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<string[]> {
    return this._client.get('/apis/cloud.sn.io/v1/connectors/sources', cloudGate(this._client, options));
  }

  /**
   * Restart every source connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.restart('events');
   * ```
   */
  restart(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}:restart`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Restart one source connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.restartInstance('events', '0');
   * ```
   */
  restartInstance(name: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}/${instanceId}:restart`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Start every source connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.start('events');
   * ```
   */
  start(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}:start`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Start one source connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.startInstance('events', '0');
   * ```
   */
  startInstance(name: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}/${instanceId}:start`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Stop every source connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.stop('events');
   * ```
   */
  stop(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}:stop`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Stop one source connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sources.stopInstance('events', '0');
   * ```
   */
  stopInstance(name: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sources/${name}/${instanceId}:stop`,
      cloudGateVoid(this._client, options),
    );
  }
}
