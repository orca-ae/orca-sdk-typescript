// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import { KafkaCatalog } from './kafka';
import * as KafkaAPI from './kafka';
import { SinkCatalog } from './sinks';
import * as SinksAPI from './sinks';
import { SourceCatalog } from './sources';
import * as SourcesAPI from './sources';

export class Catalog extends APIResource {
  /** Kafka connector definitions. */
  kafka: KafkaAPI.KafkaCatalog = new KafkaCatalog(this._client);

  /** Sink connector definitions. */
  sinks: SinksAPI.SinkCatalog = new SinkCatalog(this._client);

  /** Source connector definitions. */
  sources: SourcesAPI.SourceCatalog = new SourceCatalog(this._client);
}
