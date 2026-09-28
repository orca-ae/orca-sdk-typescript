// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Discovery resource (`orca.discovery`).
 *
 * This runs behind `describeIfCredentials` like every other integration
 * suite so authenticated discovery calls remain opt-in.
 */

import { describeIfCredentials, getTestClient } from './setup';
import type { Orca } from '@orca-ae/orca-sdk';

describeIfCredentials('Discovery (integration)', () => {
  let client: Orca;

  beforeAll(() => {
    client = getTestClient();
  });

  test('groups — returns a well-formed API group list', async () => {
    const result = await client.discovery.groups();
    expect(result.kind).toBe('APIGroupList');
    expect(Array.isArray(result.groups)).toBe(true);
  });
});
