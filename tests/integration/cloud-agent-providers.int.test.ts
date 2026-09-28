// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Cloud agent providers extension.
 *
 * Provider discovery is read-only. The live call is skipped when the
 * configured deployment does not advertise `cloud.sn.io`.
 */

import { describeIfCredentials, getTestClient, supportsExtension } from './setup';
import type { AgentProvider, Orca } from '@runorca/orca-sdk';

describeIfCredentials('Cloud agent providers (integration)', () => {
  let client: Orca;
  let extensionAvailable = false;

  beforeAll(async () => {
    client = getTestClient();
    extensionAvailable = await supportsExtension(client, 'cloud.sn.io');
  });

  test('list — returns configured providers', async () => {
    if (!extensionAvailable) return;

    const providers: AgentProvider[] = await client.cloud.agents.providers.list();
    expect(Array.isArray(providers)).toBe(true);
  });
});
