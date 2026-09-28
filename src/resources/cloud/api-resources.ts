// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { cloudGate } from './gate';

export interface CloudAPIResource {
  name: string;
  namespaced: boolean;
  kind: string;
}

export interface CloudAPIResourceList {
  kind: 'APIResourceList';
  group_version: string;
  resources: CloudAPIResource[];
}

export class APIResources extends APIResource {
  /**
   * List resources advertised by the hosted extension group.
   *
   * @example
   * ```ts
   * const resources = await orca.cloud.apiResources.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<CloudAPIResourceList> {
    return this._client.get('/apis/cloud.sn.io/v1/', cloudGate(this._client, options));
  }
}
