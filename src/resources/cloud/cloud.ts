// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import * as CloudAgentsAPI from './agents';
import { CloudAgents } from './agents';
import * as APIResourcesAPI from './api-resources';
import { APIResources } from './api-resources';
import * as CatalogAPI from './catalog';
import { Catalog } from './catalog';
import * as ConnectionsAPI from './connections';
import { Connections } from './connections';
import * as ConnectorsAPI from './connectors';
import { Connectors } from './connectors';
import * as FunctionsAPI from './functions';
import { Functions } from './functions';
import * as HealthAPI from './health';
import { Health } from './health';
import * as PackagesAPI from './packages';
import { Packages } from './packages';

/**
 * Hosted extensions — operations in the hosted extension group, served under
 * `/apis/cloud.sn.io/v1/*` by the hosted distribution rather than the
 * open-source engine. Every method reached through `orca.cloud.*` throws
 * `ExtensionNotAvailableError` when called against a deployment that
 * doesn't advertise the `cloud.sn.io` group via `GET /apis` (a self-hosted
 * engine, for instance) — see `CLOUD_EXTENSION_GROUP` in
 * `internal/constants.ts`, the single source of truth for the group name.
 *
 * @example
 * ```ts
 * try {
 *   const providers = await orca.cloud.agents.providers.list();
 * } catch (err) {
 *   if (err instanceof ExtensionNotAvailableError) {
 *     console.log('This deployment does not serve the hosted extension group.');
 *   }
 * }
 * ```
 */
export class Cloud extends APIResource {
  /** Resources advertised by the hosted extension group. */
  apiResources: APIResourcesAPI.APIResources = new APIResources(this._client);

  /** Cloud-only agent sub-resources. */
  agents: CloudAgentsAPI.CloudAgents = new CloudAgents(this._client);

  /** Read-only connector catalogs. */
  catalog: CatalogAPI.Catalog = new Catalog(this._client);

  /** External connection definitions. */
  connections: ConnectionsAPI.Connections = new Connections(this._client);

  /** Function lifecycle. */
  functions: FunctionsAPI.Functions = new Functions(this._client);

  /** Service health probes. */
  health: HealthAPI.Health = new Health(this._client);

  /** Package registry. */
  packages: PackagesAPI.Packages = new Packages(this._client);

  /** Sink, source, and Kafka connector lifecycle. */
  connectors: ConnectorsAPI.Connectors = new Connectors(this._client);
}
