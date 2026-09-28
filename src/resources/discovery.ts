// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { POLICY_EXTENSION_GROUP, PRICING_EXTENSION_GROUP } from '../internal/constants';
import type { RequestOptions } from '../internal/request-options';
import { extensionGate } from './extension-gate';

// ---- Discovery response types ---------------------------------------------

export interface APIGroupVersion {
  group_version: string;
  version: string;
}

export interface APIGroup {
  /** Extension group name, e.g. `"policy.runorca.ai"`. */
  name: string;
  versions: APIGroupVersion[];
  preferred_version: APIGroupVersion;
}

export interface APIGroupList {
  kind: 'APIGroupList';
  /**
   * Extension API groups this deployment serves beyond the core surface.
   * An empty array is a normal deployment shape. Extension resources gate
   * their requests on the corresponding group; see
   * `ExtensionNotAvailableError`.
   */
  groups: APIGroup[];
}

export interface APIResourceDescription {
  name: string;
  namespaced: boolean;
  kind: string;
}

export interface APIResourceList {
  kind: 'APIResourceList';
  group_version: string;
  resources: APIResourceDescription[];
}

// ---- Resource class ---------------------------------------------------------

export class Discovery extends APIResource {
  /**
   * List the extension API groups this deployment serves. An empty
   * `groups` array means "no extensions installed" on a deployment that
   * supports discovery — distinct from the 404 an older, pre-discovery
   * deployment returns for this same call.
   *
   * Extension methods call this internally (cached for the lifetime of the
   * client instance) to decide whether to proceed or throw
   * `ExtensionNotAvailableError`; call it directly for your own capability
   * checks.
   *
   * @example
   * ```ts
   * const { groups } = await orca.discovery.groups();
   * const hasPolicy = groups.some((g) => g.name === 'policy.runorca.ai');
   * ```
   */
  groups(options?: RequestOptions): APIPromise<APIGroupList> {
    return this._client.get('/apis', options);
  }

  /**
   * List resources advertised by the policy extension API group.
   *
   * @example
   * ```ts
   * const { resources } = await orca.discovery.policyGroupResources();
   * ```
   */
  policyGroupResources(options?: RequestOptions): APIPromise<APIResourceList> {
    return this._client.get(
      '/apis/policy.runorca.ai/v1',
      extensionGate(this._client, POLICY_EXTENSION_GROUP, options),
    );
  }

  /**
   * List resources advertised by the pricing extension API group.
   *
   * @example
   * ```ts
   * const { resources } = await orca.discovery.pricingGroupResources();
   * ```
   */
  pricingGroupResources(options?: RequestOptions): APIPromise<APIResourceList> {
    return this._client.get(
      '/apis/pricing.runorca.ai/v1',
      extensionGate(this._client, PRICING_EXTENSION_GROUP, options),
    );
  }
}
