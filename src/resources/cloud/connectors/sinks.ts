// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import type { APIPromise } from '../../../core/api-promise';
import type { RequestOptions } from '../../../internal/request-options';
import type { Uploadable } from '../../../internal/uploads';
import { path } from '../../../internal/utils/path';
import { cloudGate, cloudGateVoid, cloudMultipartFormRequestOptions } from '../gate';
import type {
  ConsumerConfig,
  RuntimeExceptionInformation,
  RuntimeResources,
  RuntimeUpdateOptions,
} from '../runtime-types';

export interface SinkConfig {
  tenant?: string;
  namespace?: string;
  name?: string;
  className?: string;
  sourceSubscriptionName?: string;
  sourceSubscriptionPosition?: 'Latest' | 'Earliest';
  inputs?: string[];
  topicToSerdeClassName?: Record<string, string>;
  topicsPattern?: string;
  topicToSchemaType?: Record<string, string>;
  topicToSchemaProperties?: Record<string, string>;
  inputSpecs?: Record<string, ConsumerConfig>;
  maxMessageRetries?: number;
  deadLetterTopic?: string;
  configs?: Record<string, Record<string, unknown>>;
  secrets?: Record<string, Record<string, unknown>>;
  parallelism?: number;
  processingGuarantees?: 'ATLEAST_ONCE' | 'ATMOST_ONCE' | 'EFFECTIVELY_ONCE' | 'MANUAL';
  retainOrdering?: boolean;
  retainKeyOrdering?: boolean;
  resources?: RuntimeResources;
  autoAck?: boolean;
  timeoutMs?: number;
  negativeAckRedeliveryDelayMs?: number;
  sinkType?: string;
  archive?: string;
  cleanupSubscription?: boolean;
  runtimeFlags?: string;
  customRuntimeOptions?: string;
  transformFunction?: string;
  transformFunctionClassName?: string;
  transformFunctionConfig?: string;
  logTopic?: string;
  connection?: string;
  snServiceAccount?: string;
}

export interface SinkCreateParams {
  data?: Uploadable;
  url?: string;
  sinkConfig?: SinkConfig;
}

export interface SinkUpdateParams extends SinkCreateParams {
  updateOptions?: RuntimeUpdateOptions;
}

export interface SinkInstanceStatus {
  running?: boolean;
  error?: string;
  numRestarts?: number;
  numReadFromPulsar?: number;
  numSystemExceptions?: number;
  latestSystemExceptions?: RuntimeExceptionInformation[];
  numSinkExceptions?: number;
  latestSinkExceptions?: RuntimeExceptionInformation[];
  numWrittenToSink?: number;
  lastReceivedTime?: number;
  workerId?: string;
}

export interface SinkStatusInstance {
  instanceId?: number;
  status?: SinkInstanceStatus;
}

export interface SinkStatus {
  numInstances?: number;
  numRunning?: number;
  instances?: SinkStatusInstance[];
}

export class SinkConnectors extends APIResource {
  /**
   * Register a sink connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.create('archive', { url: 'sink://archive@latest' });
   * ```
   */
  create(name: string, params: SinkCreateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Retrieve a sink connector configuration.
   *
   * @example
   * ```ts
   * const sink = await orca.cloud.connectors.sinks.retrieve('archive');
   * ```
   */
  retrieve(name: string, options?: RequestOptions): APIPromise<SinkConfig> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Update a sink connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.update('archive', { sinkConfig: { parallelism: 2 } });
   * ```
   */
  update(name: string, params: SinkUpdateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Deregister a sink connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.delete('archive');
   * ```
   */
  delete(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Retrieve status for one sink connector instance.
   *
   * @example
   * ```ts
   * const status = await orca.cloud.connectors.sinks.retrieveInstanceStatus('archive', '0');
   * ```
   */
  retrieveInstanceStatus(
    name: string,
    instanceId: string,
    options?: RequestOptions,
  ): APIPromise<SinkInstanceStatus> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}/${instanceId}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve aggregate sink connector status.
   *
   * @example
   * ```ts
   * const status = await orca.cloud.connectors.sinks.retrieveStatus('archive');
   * ```
   */
  retrieveStatus(name: string, options?: RequestOptions): APIPromise<SinkStatus> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * List sink connector names.
   *
   * @example
   * ```ts
   * const sinks = await orca.cloud.connectors.sinks.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<string[]> {
    return this._client.get('/apis/cloud.sn.io/v1/connectors/sinks', cloudGate(this._client, options));
  }

  /**
   * Restart every sink connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.restart('archive');
   * ```
   */
  restart(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}:restart`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Restart one sink connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.restartInstance('archive', '0');
   * ```
   */
  restartInstance(name: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}/${instanceId}:restart`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Start every sink connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.start('archive');
   * ```
   */
  start(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}:start`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Start one sink connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.startInstance('archive', '0');
   * ```
   */
  startInstance(name: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}/${instanceId}:start`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Stop every sink connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.stop('archive');
   * ```
   */
  stop(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}:stop`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Stop one sink connector instance.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.sinks.stopInstance('archive', '0');
   * ```
   */
  stopInstance(name: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/sinks/${name}/${instanceId}:stop`,
      cloudGateVoid(this._client, options),
    );
  }
}
