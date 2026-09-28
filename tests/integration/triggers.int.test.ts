// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — core Triggers (`orca.triggers`).
 */

import type { Orca, Trigger } from '@orca-ae/orca-sdk';
import { describeIfCredentials, getTestClient } from './setup';

describeIfCredentials('Triggers (integration)', () => {
  let client: Orca;

  beforeAll(() => {
    client = getTestClient();
  });

  it('lists core Triggers', async () => {
    const triggers: Trigger[] = [];
    for await (const trigger of client.triggers.list({ limit: 10 })) {
      triggers.push(trigger);
    }

    expect(Array.isArray(triggers)).toBe(true);
  });
});
