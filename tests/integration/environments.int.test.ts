// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Environments resource.
 *
 * Full CRUD round-trip: create → list → retrieve → update → archive → verify.
 * All tests are gated on ORCA_TEST_API_KEY being present.
 */

import {
  describeIfCredentials,
  getTestClient,
  getTestPrefix,
  cleanupCreatedEnvironments,
} from './setup';
import type { Environment, Orca } from '@runorca/orca-sdk';

describeIfCredentials('Environments (integration)', () => {
  let client: Orca;
  let prefix: string;
  let createdEnv: Environment;

  beforeAll(() => {
    client = getTestClient();
    prefix = getTestPrefix();
  });

  afterAll(async () => {
    await cleanupCreatedEnvironments(client, prefix);
  });

  test('create — returns a valid environment', async () => {
    const env = await client.environments.create({
      name: `${prefix}-env`,
      description: 'Integration test environment',
    });

    expect(env.id).toBeTruthy();
    expect(env.name).toBe(`${prefix}-env`);
    expect(env.type).toBe('environment');
    createdEnv = env;
  });

  test('list — created environment appears in listing', async () => {
    const found: Environment[] = [];
    for await (const e of client.environments.list()) {
      if (e.name.startsWith(prefix)) {
        found.push(e);
      }
    }
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((e) => e.id === createdEnv.id)).toBe(true);
  });

  test('retrieve — fetches the environment by id', async () => {
    const env = await client.environments.retrieve(createdEnv.id);
    expect(env.id).toBe(createdEnv.id);
    expect(env.name).toBe(createdEnv.name);
  });

  test('update — modifies description', async () => {
    const updated = await client.environments.update(createdEnv.id, {
      description: 'Updated by integration test',
    });
    expect(updated.description).toBe('Updated by integration test');
    createdEnv = updated;
  });

  test('archive — soft-deletes the environment', async () => {
    await expect(
      client.environments.archive(createdEnv.id),
    ).resolves.toBeUndefined();
  });

  test('list (no archived) — archived environment not visible by default', async () => {
    const found: Environment[] = [];
    for await (const e of client.environments.list()) {
      if (e.id === createdEnv.id) {
        found.push(e);
      }
    }
    expect(found.length).toBe(0);
  });
});
