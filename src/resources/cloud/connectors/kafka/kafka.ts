// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../../core/resource';
import type { APIPromise } from '../../../../core/api-promise';
import type { RequestOptions } from '../../../../internal/request-options';
import { cloudGate } from '../../gate';
import { KafkaConnectors } from './connectors';
import * as ConnectorsAPI from './connectors';
import { Plugins } from './plugins';
import * as PluginsAPI from './plugins';

export interface KafkaWorkerStatus {
  status?: string;
  message?: string;
}

export interface KafkaServerInfo {
  version?: string;
  commit?: string;
  kafka_cluster_id?: string;
}

export class Kafka extends APIResource {
  /** Connector plugin discovery. */
  plugins: PluginsAPI.Plugins = new Plugins(this._client);

  /** Kafka connector lifecycle. */
  connectors: ConnectorsAPI.KafkaConnectors = new KafkaConnectors(this._client);

  /**
   * Check Kafka Connect worker health.
   *
   * @example
   * ```ts
   * const health = await orca.cloud.connectors.kafka.health();
   * ```
   */
  health(options?: RequestOptions): APIPromise<KafkaWorkerStatus> {
    return this._client.get('/apis/cloud.sn.io/v1/connectors/kafka/health', cloudGate(this._client, options));
  }

  /**
   * Retrieve Kafka Connect worker information.
   *
   * @example
   * ```ts
   * const info = await orca.cloud.connectors.kafka.serverInfo();
   * ```
   */
  serverInfo(options?: RequestOptions): APIPromise<KafkaServerInfo> {
    return this._client.get('/apis/cloud.sn.io/v1/connectors/kafka', cloudGate(this._client, options));
  }
}
