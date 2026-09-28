// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Vaults resource.
 *
 * create → list → retrieve → archive → verify absence.
 * All tests are gated on ORCA_TEST_API_KEY being present.
 */

import {
  describeIfCredentials,
  getTestClient,
  getTestPrefix,
  cleanupCreatedVaults,
} from './setup';
import type { Orca, Vault } from '@orca-ae/orca-sdk';

describeIfCredentials('Vaults (integration)', () => {
  let client: Orca;
  let prefix: string;
  let createdVault: Vault;

  beforeAll(() => {
    client = getTestClient();
    prefix = getTestPrefix();
  });

  afterAll(async () => {
    await cleanupCreatedVaults(client, prefix);
  });

  test('create — returns a valid vault', async () => {
    const vault = await client.vaults.create({
      display_name: `${prefix}-vault`,
    });

    expect(vault.id).toBeTruthy();
    expect(vault.type).toBe('vault');
    expect(vault.display_name).toBe(`${prefix}-vault`);
    createdVault = vault;
  });

  test('list — created vault appears in listing', async () => {
    const found: Vault[] = [];
    for await (const v of client.vaults.list()) {
      if (v.display_name?.startsWith(prefix)) {
        found.push(v);
      }
    }
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((v) => v.id === createdVault.id)).toBe(true);
  });

  test('retrieve — fetches the vault by id', async () => {
    const fetched = await client.vaults.retrieve(createdVault.id);
    expect(fetched.id).toBe(createdVault.id);
    expect(fetched.display_name).toBe(createdVault.display_name);
  });

  test('archive — soft-deletes the vault', async () => {
    await expect(
      client.vaults.archive(createdVault.id),
    ).resolves.toBeUndefined();
  });

  test('list (no archived) — archived vault not visible by default', async () => {
    const found: Vault[] = [];
    for await (const v of client.vaults.list()) {
      if (v.id === createdVault.id) found.push(v);
    }
    expect(found.length).toBe(0);
  });
});
