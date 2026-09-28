// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import * as ProvidersAPI from './providers';
import { Providers } from './providers';

/**
 * Hosted-only agent sub-resources. Mounted as `orca.cloud.agents` — the
 * counterpart to core `orca.agents`, for operations that only the hosted
 * extension group serves.
 */
export class CloudAgents extends APIResource {
  /** LLM provider registry (hosted extension group). */
  providers: ProvidersAPI.Providers = new Providers(this._client);
}
