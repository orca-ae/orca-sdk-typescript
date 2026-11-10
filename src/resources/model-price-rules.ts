// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import {
  PageCursor,
  type PageClient,
  type PageCursorParams,
  type PageCursorResponse,
  type PagePromise,
} from '../core/pagination';
import { APIResource } from '../core/resource';
import { PRICING_EXTENSION_GROUP } from '../internal/constants';
import type { FinalRequestOptions, RequestOptions } from '../internal/request-options';
import { extensionGate } from './extension-gate';

export interface ModelPriceRule {
  conditions: { service_tier: string; request_input_tokens: { min: number; max: number | null } };
  rates: {
    input_per_million_tokens: number;
    output_per_million_tokens: number;
    cache_read_per_million_tokens: number | null;
    cache_write_per_million_tokens: number | null;
    cache_write_1h_per_million_tokens: number | null;
  };
  rule_set_id: string;
  rule_id: string;
  revision: number;
  provider: string;
  model_id: string;
  source: 'operator' | 'upstream' | 'seed';
  organization_id?: string;
  usage_profile: 'exclusive-v1' | 'anthropic-cache-v1';
  profile_version: string;
  provenance: { source_id: string; document_sha256: string; adapter_version: string; observed_at: string };
  provider_effective_at: string | null;
  active_from: string;
  retired_at: string | null;
  valid_until: string | null;
}

export interface ModelPriceRuleCatalog {
  catalog_id: string;
  generation: number;
  digest: string;
  published_at: string;
  expires_at: string;
  required_features: string[];
  conditional_models: Array<{ provider: string; model_id: string }>;
}

export interface ModelPriceRuleListResponse
  extends PageCursorResponse<ModelPriceRule>, ModelPriceRuleCatalog {
  next_page: string | null;
}
export type ModelPriceRuleListParams = PageCursorParams;

/** Catalog metadata belongs to each snapshot page, including pages fetched by iteration. */
export class ModelPriceRulePage extends PageCursor<ModelPriceRule> implements ModelPriceRuleCatalog {
  catalog_id: string;
  generation: number;
  digest: string;
  published_at: string;
  expires_at: string;
  required_features: string[];
  conditional_models: Array<{ provider: string; model_id: string }>;

  constructor(client: PageClient, body: PageCursorResponse<ModelPriceRule>, options: FinalRequestOptions) {
    super(client, body, options);
    const response = body as ModelPriceRuleListResponse;
    this.catalog_id = response.catalog_id;
    this.generation = response.generation;
    this.digest = response.digest;
    this.published_at = response.published_at;
    this.expires_at = response.expires_at;
    this.required_features = response.required_features;
    this.conditional_models = response.conditional_models;
  }

  /** Fetch the next snapshot page while retaining its catalog metadata type. */
  override async getNextPage(): Promise<ModelPriceRulePage> {
    return (await super.getNextPage()) as ModelPriceRulePage;
  }
}

export class ModelPriceRules extends APIResource {
  /**
   * List a pricing v2 catalog snapshot. An expired cursor returns 410; the SDK never restarts it.
   * @example
   * const page = await orca.modelPriceRules.list();
   */
  list(
    params: ModelPriceRuleListParams = {},
    options?: RequestOptions,
  ): PagePromise<ModelPriceRulePage, ModelPriceRule> {
    return this._client.getAPIList(
      '/apis/pricing.runorca.ai/v2/modelpricerules',
      ModelPriceRulePage,
      extensionGate(this._client, PRICING_EXTENSION_GROUP, { query: params, ...options }, 'v2'),
    );
  }
}
