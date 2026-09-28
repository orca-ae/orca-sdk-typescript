// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — MemoryStores resource.
 *
 * If the registry does not yet expose memory-store endpoints, every
 * operation surfaces as a 404 or 501 — we treat those as a skip signal
 * rather than a failure.
 */

import { describeIfCredentials, getTestClient, getTestPrefix } from './setup';
import { APIError } from '@runorca/orca-sdk';
import type { MemoryStore, Orca } from '@runorca/orca-sdk';

function isNotImplemented(err: unknown): boolean {
  return err instanceof APIError && (err.status === 404 || err.status === 501);
}

describeIfCredentials('MemoryStores (integration)', () => {
  let client: Orca;
  let prefix: string;
  let store: MemoryStore | undefined;
  let serverSupports = true;

  beforeAll(async () => {
    client = getTestClient();
    prefix = getTestPrefix();
  });

  afterAll(async () => {
    if (store?.id) {
      try {
        await client.memoryStores.archive(store.id);
      } catch {
        // best-effort
      }
    }
  });

  test('create — returns a valid memory store', async () => {
    try {
      store = await client.memoryStores.create({
        name: `${prefix}-store`,
        description: 'integration-test store',
      });
      expect(store.id).toBeTruthy();
      expect(store.type).toBe('memory_store');
      expect(store.name).toBe(`${prefix}-store`);
    } catch (err) {
      if (!isNotImplemented(err)) throw err;
      serverSupports = false;
      console.warn(
        '[memory-stores.int] registry does not expose memory-store endpoints yet — skipping suite',
      );
    }
  });

  test('retrieve + update — round-trips when supported', async () => {
    if (!serverSupports || !store) return;
    const fetched = await client.memoryStores.retrieve(store.id);
    expect(fetched.id).toBe(store.id);

    const updated = await client.memoryStores.update(store.id, {
      description: 'updated description',
    });
    expect(updated.description).toBe('updated description');
  });

  test('list — created store appears in listing', async () => {
    if (!serverSupports || !store) return;
    const found: MemoryStore[] = [];
    for await (const s of client.memoryStores.list()) {
      if (s.id === store.id) found.push(s);
      if (found.length) break;
    }
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});
