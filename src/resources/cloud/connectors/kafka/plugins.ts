// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../../core/resource';
import type { APIPromise } from '../../../../core/api-promise';
import type { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';
import { cloudGate } from '../../gate';
import type { ConfigFieldDefinition } from '../../catalog/types';

export interface KafkaConfigKeyInfo {
  name?: string;
  type?: string;
  required?: boolean;
  default_value?: string;
  importance?: string;
  documentation?: string;
  group?: string;
  width?: string;
  display_name?: string;
  dependents?: string[];
  order?: number;
}

export interface KafkaPluginInfo {
  class?: string;
  type?: string;
  version?: string;
}

export interface KafkaPluginCatalogEntry {
  name?: string;
  description?: string;
  sourceClass?: string;
  sinkClass?: string;
  sourceConfigClass?: string;
  sinkConfigClass?: string;
  id?: string;
  version?: string;
  imageRegistry?: string;
  imageRepository?: string;
  imageTag?: string;
  typeClassName?: string;
  sourceTypeClassName?: string;
  sinkTypeClassName?: string;
  jarFullName?: string;
  defaultSchemaType?: string;
  defaultSerdeClassName?: string;
  iconLink?: string;
  sinkDocLink?: string;
  sourceDocLink?: string;
  sinkConfigFieldDefinitions?: ConfigFieldDefinition[];
  sourceConfigFieldDefinitions?: ConfigFieldDefinition[];
  jar?: string;
}

export interface KafkaPluginListParams {
  connectorsOnly?: boolean;
}

export class Plugins extends APIResource {
  /**
   * Retrieve a Kafka connector plugin configuration definition.
   *
   * @example
   * ```ts
   * const config = await orca.cloud.connectors.kafka.plugins.retrieveConfig('FileStreamSource');
   * ```
   */
  retrieveConfig(pluginName: string, options?: RequestOptions): APIPromise<KafkaConfigKeyInfo[]> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/connectors/kafka/connector-plugins/${pluginName}/config`,
      cloudGate(this._client, options),
    );
  }

  /**
   * List installed Kafka connector plugins.
   *
   * @example
   * ```ts
   * const plugins = await orca.cloud.connectors.kafka.plugins.list({ connectorsOnly: true });
   * ```
   */
  list(params: KafkaPluginListParams = {}, options?: RequestOptions): APIPromise<KafkaPluginInfo[]> {
    return this._client.get(
      '/apis/cloud.sn.io/v1/connectors/kafka/connector-plugins',
      cloudGate(this._client, { query: params, ...options }),
    );
  }

  /**
   * List the Kafka connector plugin catalog.
   *
   * @example
   * ```ts
   * const catalog = await orca.cloud.connectors.kafka.plugins.listCatalog();
   * ```
   */
  listCatalog(options?: RequestOptions): APIPromise<KafkaPluginCatalogEntry[]> {
    return this._client.get(
      '/apis/cloud.sn.io/v1/connectors/kafka/connector-plugins/catalog',
      cloudGate(this._client, options),
    );
  }
}
