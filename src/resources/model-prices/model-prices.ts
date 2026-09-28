// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../core/pagination';
import { APIResource } from '../../core/resource';
import { PRICING_EXTENSION_GROUP } from '../../internal/constants';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { extensionGate } from '../extension-gate';

export interface ModelPrice {
  type: 'model_price';
  provider: string;
  model_id: string;
  input_per_million_tokens: number;
  output_per_million_tokens: number;
  cache_read_per_million_tokens: number;
  cache_write_per_million_tokens: number;
}

export type ModelPriceListParams = PageCursorParams;

export interface ModelPriceRetrieveParams {
  provider?: string;
}

export class ModelPrices extends APIResource {
  /**
   * List the effective model prices used for cost accounting.
   *
   * @example
   * ```ts
   * for await (const price of orca.modelPrices.list()) { ... }
   * ```
   */
  list(
    params: ModelPriceListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<ModelPrice>, ModelPrice> {
    return this._client.getAPIList(
      '/apis/pricing.runorca.ai/v1/modelprices',
      PageCursor<ModelPrice>,
      extensionGate(this._client, PRICING_EXTENSION_GROUP, { query: params, ...options }),
    );
  }

  /**
   * Retrieve the effective price for a model and optional provider.
   *
   * @example
   * ```ts
   * const price = await orca.modelPrices.retrieve('model-alpha', { provider: 'provider-a' });
   * ```
   */
  retrieve(
    modelId: string,
    params: ModelPriceRetrieveParams = {},
    options?: RequestOptions,
  ): APIPromise<ModelPrice> {
    return this._client.get(
      path`/apis/pricing.runorca.ai/v1/modelprices/${modelId}`,
      extensionGate(this._client, PRICING_EXTENSION_GROUP, { query: params, ...options }),
    );
  }
}
