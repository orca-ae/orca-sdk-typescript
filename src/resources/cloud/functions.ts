// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import type { RequestOptions } from '../../internal/request-options';
import type { Uploadable } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { cloudGate, cloudGateVoid, cloudMultipartFormRequestOptions } from './gate';
import type {
  ConsumerConfig,
  ProducerConfig,
  RuntimeExceptionInformation,
  RuntimeResources,
  RuntimeUpdateOptions,
} from './runtime-types';

export interface FunctionWindowConfig {
  windowLengthCount?: number;
  windowLengthDurationMs?: number;
  slidingIntervalCount?: number;
  slidingIntervalDurationMs?: number;
  lateDataTopic?: string;
  maxLagMs?: number;
  watermarkEmitIntervalMs?: number;
  timestampExtractorClassName?: string;
  actualWindowFunctionClassName?: string;
  processingGuarantees?: 'ATLEAST_ONCE' | 'ATMOST_ONCE';
}

export interface FunctionConfig {
  runtimeFlags?: string;
  tenant?: string;
  namespace?: string;
  name?: string;
  className?: string;
  inputs?: string[];
  customSerdeInputs?: Record<string, string>;
  topicsPattern?: string;
  customSchemaInputs?: Record<string, string>;
  customSchemaOutputs?: Record<string, string>;
  inputSpecs?: Record<string, ConsumerConfig>;
  inputTypeClassName?: string;
  output?: string;
  producerConfig?: ProducerConfig;
  outputSchemaType?: string;
  outputTypeClassName?: string;
  outputSerdeClassName?: string;
  logTopic?: string;
  processingGuarantees?: 'ATLEAST_ONCE' | 'ATMOST_ONCE' | 'EFFECTIVELY_ONCE' | 'MANUAL';
  retainOrdering?: boolean;
  retainKeyOrdering?: boolean;
  batchBuilder?: string;
  forwardSourceMessageProperty?: boolean;
  userConfig?: Record<string, Record<string, unknown>>;
  secrets?: Record<string, Record<string, unknown>>;
  runtime?: 'JAVA' | 'PYTHON' | 'GO';
  autoAck?: boolean;
  maxMessageRetries?: number;
  deadLetterTopic?: string;
  subName?: string;
  parallelism?: number;
  resources?: RuntimeResources;
  fqfn?: string;
  windowConfig?: FunctionWindowConfig;
  timeoutMs?: number;
  jar?: string;
  py?: string;
  go?: string;
  functionType?: string;
  cleanupSubscription?: boolean;
  customRuntimeOptions?: string;
  maxPendingAsyncRequests?: number;
  exposePulsarAdminClientEnabled?: boolean;
  skipToLatest?: boolean;
  subscriptionPosition?: 'Latest' | 'Earliest';
  connection?: string;
  snServiceAccount?: string;
}

export interface FunctionCreateParams {
  data?: Uploadable;
  url?: string;
  functionConfig?: FunctionConfig;
}

export interface FunctionUpdateParams extends FunctionCreateParams {
  updateOptions?: RuntimeUpdateOptions;
}

export interface FunctionStatsBase {
  receivedTotal?: number;
  processedSuccessfullyTotal?: number;
  systemExceptionsTotal?: number;
  userExceptionsTotal?: number;
  avgProcessLatency?: number;
}

export interface FunctionInstanceStats extends FunctionStatsBase {
  '1min'?: FunctionStatsBase;
  lastInvocation?: number;
  userMetrics?: Record<string, number>;
}

export interface FunctionInstanceStatus {
  running?: boolean;
  error?: string;
  numRestarts?: number;
  numReceived?: number;
  numSuccessfullyProcessed?: number;
  numUserExceptions?: number;
  latestUserExceptions?: RuntimeExceptionInformation[];
  numSystemExceptions?: number;
  latestSystemExceptions?: RuntimeExceptionInformation[];
  averageLatency?: number;
  lastInvocationTime?: number;
  workerId?: string;
}

export interface FunctionState {
  key?: string;
  stringValue?: string;
  byteValue?: string;
  numberValue?: number;
  version?: number;
}

export interface FunctionStateUpdateParams {
  state?: FunctionState;
}

export interface FunctionStatsInstance {
  instanceId?: number;
  metrics?: FunctionStatsBase & {
    lastInvocation?: number;
    oneMin?: FunctionStatsBase;
    userMetrics?: Record<string, number>;
  };
}

export interface FunctionStats extends FunctionStatsBase {
  '1min'?: FunctionStatsBase;
  lastInvocation?: number;
  instances?: FunctionStatsInstance[];
}

export interface FunctionStatusInstance {
  instanceId?: number;
  status?: FunctionInstanceStatus;
}

export interface FunctionStatus {
  numInstances?: number;
  numRunning?: number;
  instances?: FunctionStatusInstance[];
}

export interface FunctionTriggerParams {
  data?: string;
  dataStream?: Uploadable;
  topic?: string;
}

export class Functions extends APIResource {
  /**
   * Register a function.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.create('transform', { url: 'function://transform@latest' });
   * ```
   */
  create(functionName: string, params: FunctionCreateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Retrieve a function configuration.
   *
   * @example
   * ```ts
   * const fn = await orca.cloud.functions.retrieve('transform');
   * ```
   */
  retrieve(functionName: string, options?: RequestOptions): APIPromise<FunctionConfig> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/functions/${functionName}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Update a function.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.update('transform', { functionConfig: { parallelism: 2 } });
   * ```
   */
  update(functionName: string, params: FunctionUpdateParams, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/functions/${functionName}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Deregister a function.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.delete('transform');
   * ```
   */
  delete(functionName: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(
      path`/apis/cloud.sn.io/v1/functions/${functionName}`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Retrieve statistics for a function instance.
   *
   * @example
   * ```ts
   * const stats = await orca.cloud.functions.retrieveInstanceStats('transform', '0');
   * ```
   */
  retrieveInstanceStats(
    functionName: string,
    instanceId: string,
    options?: RequestOptions,
  ): APIPromise<FunctionInstanceStats> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/${instanceId}/stats`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve status for a function instance.
   *
   * @example
   * ```ts
   * const status = await orca.cloud.functions.retrieveInstanceStatus('transform', '0');
   * ```
   */
  retrieveInstanceStatus(
    functionName: string,
    instanceId: string,
    options?: RequestOptions,
  ): APIPromise<FunctionInstanceStatus> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/${instanceId}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve a function state value.
   *
   * @example
   * ```ts
   * const state = await orca.cloud.functions.retrieveState('transform', 'offset');
   * ```
   */
  retrieveState(functionName: string, key: string, options?: RequestOptions): APIPromise<FunctionState> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/state/${key}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Write a function state value.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.updateState('transform', 'offset', { state: { numberValue: 10 } });
   * ```
   */
  updateState(
    functionName: string,
    key: string,
    params: FunctionStateUpdateParams,
    options?: RequestOptions,
  ): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/state/${key}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Retrieve aggregate function statistics.
   *
   * @example
   * ```ts
   * const stats = await orca.cloud.functions.retrieveStats('transform');
   * ```
   */
  retrieveStats(functionName: string, options?: RequestOptions): APIPromise<FunctionStats> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/stats`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve aggregate function status.
   *
   * @example
   * ```ts
   * const status = await orca.cloud.functions.retrieveStatus('transform');
   * ```
   */
  retrieveStatus(functionName: string, options?: RequestOptions): APIPromise<FunctionStatus> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * List registered function names.
   *
   * @example
   * ```ts
   * const functions = await orca.cloud.functions.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<string[]> {
    return this._client.get('/apis/cloud.sn.io/v1/functions', cloudGate(this._client, options));
  }

  /**
   * Restart every instance of a function.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.restart('transform');
   * ```
   */
  restart(functionName: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}:restart`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Restart one function instance.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.restartInstance('transform', '0');
   * ```
   */
  restartInstance(functionName: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/${instanceId}:restart`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Start every instance of a function.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.start('transform');
   * ```
   */
  start(functionName: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}:start`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Start one function instance.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.startInstance('transform', '0');
   * ```
   */
  startInstance(functionName: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/${instanceId}:start`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Stop every instance of a function.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.stop('transform');
   * ```
   */
  stop(functionName: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}:stop`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Stop one function instance.
   *
   * @example
   * ```ts
   * await orca.cloud.functions.stopInstance('transform', '0');
   * ```
   */
  stopInstance(functionName: string, instanceId: string, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}/${instanceId}:stop`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Trigger a function with inline or streamed input.
   *
   * @example
   * ```ts
   * const result = await orca.cloud.functions.trigger('transform', { data: 'hello' });
   * ```
   */
  trigger(functionName: string, params: FunctionTriggerParams, options?: RequestOptions): APIPromise<string> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/functions/${functionName}:trigger`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }
}
