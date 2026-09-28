// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import type { APIPromise } from '../../../core/api-promise';
import type { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';
import { cloudGate } from '../gate';
import type { ConfigFieldDefinition, ConnectorDefinition } from './types';

export class SourceCatalog extends APIResource {
  /**
   * List source connector definitions.
   *
   * @example
   * ```ts
   * const connectors = await orca.cloud.catalog.sources.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<ConnectorDefinition[]> {
    return this._client.get('/apis/cloud.sn.io/v1/catalog/sources', cloudGate(this._client, options));
  }

  /**
   * Retrieve a source connector configuration definition.
   *
   * @example
   * ```ts
   * const fields = await orca.cloud.catalog.sources.retrieve('http');
   * ```
   */
  retrieve(name: string, options?: RequestOptions): APIPromise<ConfigFieldDefinition[]> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/catalog/sources/${name}`,
      cloudGate(this._client, options),
    );
  }
}
