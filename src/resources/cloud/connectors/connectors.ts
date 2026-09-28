// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../../core/resource';
import { Kafka } from './kafka';
import * as KafkaAPI from './kafka';
import { SinkConnectors } from './sinks';
import * as SinksAPI from './sinks';
import { SourceConnectors } from './sources';
import * as SourcesAPI from './sources';

export class Connectors extends APIResource {
  /** Sink connector lifecycle. */
  sinks: SinksAPI.SinkConnectors = new SinkConnectors(this._client);

  /** Source connector lifecycle. */
  sources: SourcesAPI.SourceConnectors = new SourceConnectors(this._client);

  /** Kafka Connect worker and connector lifecycle. */
  kafka: KafkaAPI.Kafka = new Kafka(this._client);
}
