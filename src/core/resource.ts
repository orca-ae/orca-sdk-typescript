// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Orca } from '../client';

export class APIResource {
  protected _client: Orca;

  constructor(client: Orca) {
    this._client = client;
  }
}
