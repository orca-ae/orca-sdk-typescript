// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Skills resource.
 *
 * The test environment may not have skills configured, so we only verify
 * that the list endpoint responds with a 2xx status and returns iterable
 * items (possibly empty).
 *
 * All tests are gated on ORCA_TEST_API_KEY being present.
 */

import { describeIfCredentials, getTestClient } from './setup';
import type { Orca } from '@orca-ae/orca-sdk';

describeIfCredentials('Skills (integration)', () => {
  let client: Orca;

  beforeAll(() => {
    client = getTestClient();
  });

  test('list — endpoint responds 2xx and returns iterable items', async () => {
    const items: unknown[] = [];
    // Collect up to 10 items to avoid a slow test on large registries.
    let count = 0;
    for await (const skill of client.skills.list()) {
      items.push(skill);
      count++;
      if (count >= 10) break;
    }
    // We don't assert a minimum count — the registry may be empty.
    // The key assertion is that no error was thrown (endpoint is reachable).
    expect(Array.isArray(items)).toBe(true);
  });
});
