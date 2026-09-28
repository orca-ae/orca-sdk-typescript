// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../../core/resource';
import type { APIPromise } from '../../../../core/api-promise';
import type { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';
import { cloudGate, cloudGateVoid } from '../../gate';

/** The spec leaves this successful JSON object open. */
export type KafkaOpenResponse = Record<string, unknown>;

export interface KafkaMessage {
  message?: string;
}

export interface KafkaConnectorOffset {
  partition?: Record<string, unknown>;
  offset?: Record<string, unknown>;
}

export interface KafkaConnectorOffsets {
  offsets?: KafkaConnectorOffset[];
}

export interface KafkaConnectorTaskID {
  connector?: string;
  task?: number;
}

export interface KafkaConnectorInfo {
  name?: string;
  config?: Record<string, string>;
  tasks?: KafkaConnectorTaskID[];
  type?: 'source' | 'sink' | 'unknown';
}

export interface KafkaConnectorCreateParams {
  name?: string;
  config?: Record<string, string>;
  initial_state?: 'RUNNING' | 'PAUSED' | 'STOPPED';
}

export interface KafkaConnectorState {
  state?: string;
  worker_id?: string;
  trace?: string;
}

export interface KafkaTaskState {
  id?: number;
  state?: string;
  worker_id?: string;
  trace?: string;
}

export interface KafkaConnectorStateInfo {
  name?: string;
  connector?: KafkaConnectorState;
  tasks?: KafkaTaskState[];
  type?: 'source' | 'sink' | 'unknown';
}

export interface KafkaTaskInfo {
  id?: KafkaConnectorTaskID;
  config?: Record<string, string>;
}

export type KafkaConnectorUpdateConfigParams = Record<string, string>;

export interface KafkaConnectorRestartParams {
  includeTasks?: boolean;
  onlyFailed?: boolean;
}

export class KafkaConnectors extends APIResource {
  /**
   * Retrieve connector offsets.
   *
   * @example
   * ```ts
   * const offsets = await orca.cloud.connectors.kafka.connectors.retrieveOffsets('events');
   * ```
   */
  retrieveOffsets(name: string, options?: RequestOptions): APIPromise<KafkaConnectorOffsets> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/offsets`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Reset connector offsets.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.resetOffsets('events');
   * ```
   */
  resetOffsets(name: string, options?: RequestOptions): APIPromise<KafkaMessage> {
    return this._client.delete(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/offsets`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Alter connector offsets.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.updateOffsets('events', { offsets: [] });
   * ```
   */
  updateOffsets(
    name: string,
    params: KafkaConnectorOffsets,
    options?: RequestOptions,
  ): APIPromise<KafkaMessage> {
    return this._client.patch(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/offsets`,
      cloudGate(this._client, { body: params, ...options }),
    );
  }

  /**
   * List active Kafka connectors.
   *
   * @example
   * ```ts
   * const connectors = await orca.cloud.connectors.kafka.connectors.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<KafkaOpenResponse> {
    return this._client.get(
      '/apis/cloud.sn.io/v1/connectors/kafka/connectors',
      cloudGate(this._client, options),
    );
  }

  /**
   * Create a Kafka connector.
   *
   * @example
   * ```ts
   * const connector = await orca.cloud.connectors.kafka.connectors.create({ name: 'events' });
   * ```
   */
  create(params: KafkaConnectorCreateParams, options?: RequestOptions): APIPromise<KafkaConnectorInfo> {
    return this._client.post(
      '/apis/cloud.sn.io/v1/connectors/kafka/connectors',
      cloudGate(this._client, { body: params, ...options }),
    );
  }

  /**
   * Retrieve a Kafka connector.
   *
   * @example
   * ```ts
   * const connector = await orca.cloud.connectors.kafka.connectors.retrieve('events');
   * ```
   */
  retrieve(name: string, options?: RequestOptions): APIPromise<KafkaConnectorInfo> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Delete a Kafka connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.delete('events');
   * ```
   */
  delete(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Retrieve a connector's active topics.
   *
   * @example
   * ```ts
   * const topics = await orca.cloud.connectors.kafka.connectors.retrieveActiveTopics('events');
   * ```
   */
  retrieveActiveTopics(name: string, options?: RequestOptions): APIPromise<KafkaOpenResponse> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/topics`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve connector configuration.
   *
   * @example
   * ```ts
   * const config = await orca.cloud.connectors.kafka.connectors.retrieveConfig('events');
   * ```
   */
  retrieveConfig(name: string, options?: RequestOptions): APIPromise<KafkaOpenResponse> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/config`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Replace connector configuration.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.updateConfig('events', { 'tasks.max': '2' });
   * ```
   */
  updateConfig(
    name: string,
    params: KafkaConnectorUpdateConfigParams,
    options?: RequestOptions,
  ): APIPromise<KafkaConnectorInfo> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/config`,
      cloudGate(this._client, { body: params, ...options }),
    );
  }

  /**
   * Retrieve connector status.
   *
   * @example
   * ```ts
   * const status = await orca.cloud.connectors.kafka.connectors.retrieveStatus('events');
   * ```
   */
  retrieveStatus(name: string, options?: RequestOptions): APIPromise<KafkaConnectorStateInfo> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * List connector task configurations.
   *
   * @example
   * ```ts
   * const tasks = await orca.cloud.connectors.kafka.connectors.listTasks('events');
   * ```
   */
  listTasks(name: string, options?: RequestOptions): APIPromise<KafkaTaskInfo[]> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/tasks`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve one connector task's status.
   *
   * @example
   * ```ts
   * const task = await orca.cloud.connectors.kafka.connectors.retrieveTaskStatus('events', 0);
   * ```
   */
  retrieveTaskStatus(name: string, task: number, options?: RequestOptions): APIPromise<KafkaTaskState> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/tasks/${task}/status`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve the worker's task configuration object.
   *
   * @example
   * ```ts
   * const config = await orca.cloud.connectors.kafka.connectors.retrieveTasksConfig('events');
   * ```
   */
  retrieveTasksConfig(name: string, options?: RequestOptions): APIPromise<KafkaOpenResponse> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/tasks-config`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Pause a Kafka connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.pause('events');
   * ```
   */
  pause(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}:pause`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Reset a connector's active topics.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.resetActiveTopics('events');
   * ```
   */
  resetActiveTopics(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/topics:reset`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Restart a connector with optional task controls.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.restart('events', { includeTasks: true });
   * ```
   */
  restart(
    name: string,
    params: KafkaConnectorRestartParams = {},
    options?: RequestOptions,
  ): APIPromise<KafkaConnectorStateInfo | void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}:restart`,
      cloudGate(this._client, { query: params, ...options }),
    );
  }

  /**
   * Restart one connector task.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.restartTask('events', 0);
   * ```
   */
  restartTask(name: string, task: number, options?: RequestOptions): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}/tasks/${task}/restart`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Resume a Kafka connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.resume('events');
   * ```
   */
  resume(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}:resume`,
      cloudGateVoid(this._client, options),
    );
  }

  /**
   * Stop a Kafka connector.
   *
   * @example
   * ```ts
   * await orca.cloud.connectors.kafka.connectors.stop('events');
   * ```
   */
  stop(name: string, options?: RequestOptions): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connectors/${name}:stop`,
      cloudGateVoid(this._client, options),
    );
  }
}
