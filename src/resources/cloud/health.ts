// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { cloudGate } from './gate';

export class Health extends APIResource {
  /**
   * Check the health of the hosted extension service.
   *
   * @example
   * ```ts
   * const healthy = await orca.cloud.health.check();
   * ```
   */
  check(options?: RequestOptions): APIPromise<boolean> {
    return this._client.get('/apis/cloud.sn.io/v1/health', cloudGate(this._client, options));
  }

  /**
   * Check whether the hosted extension service is ready.
   *
   * @example
   * ```ts
   * const ready = await orca.cloud.health.ready();
   * ```
   */
  ready(options?: RequestOptions): APIPromise<boolean> {
    return this._client.get('/apis/cloud.sn.io/v1/health/ready', cloudGate(this._client, options));
  }

  /**
   * Check whether the hosted extension service is live.
   *
   * @example
   * ```ts
   * const live = await orca.cloud.health.live();
   * ```
   */
  live(options?: RequestOptions): APIPromise<boolean> {
    return this._client.get('/apis/cloud.sn.io/v1/health/live', cloudGate(this._client, options));
  }
}
