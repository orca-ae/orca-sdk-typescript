// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import type { RequestOptions } from '../../internal/request-options';
import type { Uploadable } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { cloudGate, cloudMultipartFormRequestOptions } from './gate';

export interface PackageMetadata {
  description?: string;
  contact?: string;
  createTime?: number;
  modificationTime?: number;
  properties?: Record<string, string>;
}

export interface PackageUploadParams {
  metadata?: PackageMetadata;
  file?: Uploadable;
}

export class Packages extends APIResource {
  /**
   * List package names for a package type.
   *
   * @example
   * ```ts
   * const packages = await orca.cloud.packages.list('function');
   * ```
   */
  list(type: string, options?: RequestOptions): APIPromise<unknown> {
    return this._client.get(path`/apis/cloud.sn.io/v1/packages/${type}`, cloudGate(this._client, options));
  }

  /**
   * List available versions of a package.
   *
   * @example
   * ```ts
   * const versions = await orca.cloud.packages.listVersions('function', 'transform');
   * ```
   */
  listVersions(type: string, packageName: string, options?: RequestOptions): APIPromise<unknown> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/packages/${type}/${packageName}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Download a package as a raw response.
   *
   * @example
   * ```ts
   * const response = await orca.cloud.packages.download('function', 'transform', 'v1');
   * ```
   */
  download(
    type: string,
    packageName: string,
    version: string,
    options?: RequestOptions,
  ): APIPromise<Response> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/packages/${type}/${packageName}/${version}`,
      cloudGate(this._client, { ...options, __binaryResponse: true }),
    );
  }

  /**
   * Upload a package and optional metadata.
   *
   * @example
   * ```ts
   * await orca.cloud.packages.upload('function', 'transform', 'v1', { file });
   * ```
   */
  upload(
    type: string,
    packageName: string,
    version: string,
    params: PackageUploadParams,
    options?: RequestOptions,
  ): APIPromise<void> {
    return this._client.post(
      path`/apis/cloud.sn.io/v1/packages/${type}/${packageName}/${version}`,
      cloudMultipartFormRequestOptions(this._client, params, options),
    );
  }

  /**
   * Delete a package version.
   *
   * @example
   * ```ts
   * await orca.cloud.packages.delete('function', 'transform', 'v1');
   * ```
   */
  delete(type: string, packageName: string, version: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(
      path`/apis/cloud.sn.io/v1/packages/${type}/${packageName}/${version}`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Retrieve package metadata.
   *
   * @example
   * ```ts
   * const metadata = await orca.cloud.packages.retrieveMetadata('function', 'transform', 'v1');
   * ```
   */
  retrieveMetadata(
    type: string,
    packageName: string,
    version: string,
    options?: RequestOptions,
  ): APIPromise<unknown> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/packages/${type}/${packageName}/${version}/metadata`,
      cloudGate(this._client, options),
    );
  }

  /**
   * Replace package metadata.
   *
   * @example
   * ```ts
   * await orca.cloud.packages.updateMetadata('function', 'transform', 'v1', { description: 'Transform' });
   * ```
   */
  updateMetadata(
    type: string,
    packageName: string,
    version: string,
    params: PackageMetadata,
    options?: RequestOptions,
  ): APIPromise<void> {
    return this._client.put(
      path`/apis/cloud.sn.io/v1/packages/${type}/${packageName}/${version}/metadata`,
      cloudGate(this._client, { body: params, ...options }),
    );
  }
}
