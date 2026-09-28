// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests for the read-only portions of the cloud extension surface.
 * Mutating lifecycle operations are covered hermetically by unit tests.
 */

import { describeIfCredentials, getTestClient, supportsExtension } from './setup';
import type { Orca } from '@runorca/orca-sdk';

describeIfCredentials('Cloud extensions (integration)', () => {
  let client: Orca;
  let extensionAvailable = false;

  beforeAll(async () => {
    client = getTestClient();
    extensionAvailable = await supportsExtension(client, 'cloud.sn.io');
  });

  test('API-resource discovery returns the cloud group resource list', async () => {
    if (!extensionAvailable) return;
    const resources = await client.cloud.apiResources.list();
    expect(resources.kind).toBe('APIResourceList');
    expect(Array.isArray(resources.resources)).toBe(true);
  });

  test('catalog lists connector definitions', async () => {
    if (!extensionAvailable) return;
    const [kafka, sinks, sources] = await Promise.all([
      client.cloud.catalog.kafka.list(),
      client.cloud.catalog.sinks.list(),
      client.cloud.catalog.sources.list(),
    ]);
    expect(Array.isArray(kafka)).toBe(true);
    expect(Array.isArray(sinks)).toBe(true);
    expect(Array.isArray(sources)).toBe(true);
  });

  test('connections list returns connection definitions', async () => {
    if (!extensionAvailable) return;
    expect(Array.isArray(await client.cloud.connections.list())).toBe(true);
  });

  test('functions list returns function names', async () => {
    if (!extensionAvailable) return;
    expect(Array.isArray(await client.cloud.functions.list())).toBe(true);
  });

  test('health probes return booleans', async () => {
    if (!extensionAvailable) return;
    const results = await Promise.all([
      client.cloud.health.check(),
      client.cloud.health.ready(),
      client.cloud.health.live(),
    ]);
    expect(results.every((value) => typeof value === 'boolean')).toBe(true);
  });

  test('packages list returns package names', async () => {
    if (!extensionAvailable) return;
    expect(Array.isArray(await client.cloud.packages.list('function'))).toBe(true);
  });

  test('sink and source connector lists return names', async () => {
    if (!extensionAvailable) return;
    const [sinks, sources] = await Promise.all([
      client.cloud.connectors.sinks.list(),
      client.cloud.connectors.sources.list(),
    ]);
    expect(Array.isArray(sinks)).toBe(true);
    expect(Array.isArray(sources)).toBe(true);
  });

  test('Kafka Connect exposes worker, plugin, and connector information', async () => {
    if (!extensionAvailable) return;
    const [server, plugins, connectors] = await Promise.all([
      client.cloud.connectors.kafka.serverInfo(),
      client.cloud.connectors.kafka.plugins.list(),
      client.cloud.connectors.kafka.connectors.list(),
    ]);
    expect(typeof server).toBe('object');
    expect(Array.isArray(plugins)).toBe(true);
    expect(typeof connectors).toBe('object');
  });
});
