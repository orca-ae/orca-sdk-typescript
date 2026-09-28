// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import type { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';
import { cloudGate } from '../gate';

/**
 * Information about an LLM provider configured in the registry.
 *
 * Source: `AgentProviderInfo` in `openapi/cloud-extensions.yaml`.
 */
export interface AgentProvider {
  name?: string;
  type?: string;
  api_url?: string;
  api_version?: string;
  beta_version?: string;
  /** Name of the environment variable that holds the API key. */
  api_key_env?: string;
  /** Whether an API key is already configured on the server. */
  api_key_configured?: boolean;
}

/** LLM provider registry, in the hosted extension group. */
export class Providers extends APIResource {
  /**
   * List all registered LLM providers.
   *
   * @example
   * ```ts
   * const providers = await orca.cloud.agents.providers.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<AgentProvider[]> {
    return this._client.get('/apis/cloud.sn.io/v1/agents/providers', cloudGate(this._client, options));
  }

  /**
   * Get details for a specific LLM provider.
   *
   * @example
   * ```ts
   * const provider = await orca.cloud.agents.providers.retrieve('openai');
   * ```
   */
  retrieve(providerName: string, options?: RequestOptions): APIPromise<AgentProvider> {
    return this._client.get(
      path`/apis/cloud.sn.io/v1/agents/providers/${providerName}`,
      cloudGate(this._client, options),
    );
  }
}
