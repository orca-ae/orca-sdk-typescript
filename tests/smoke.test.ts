// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import Orca, { VERSION } from '@orca-ae/orca-sdk';
import { version } from '../package.json';
import { SDK_VERSION } from '../src/internal/constants';

describe('Orca placeholder', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe(version);
    expect(SDK_VERSION).toBe(version);
  });

  it('constructs with a baseURL', () => {
    const orca = new Orca({ baseURL: 'https://example.test' });
    expect(orca.baseURL).toBe('https://example.test');
    expect(orca.maxRetries).toBe(2);
    expect(orca.triggers).toBeDefined();
    expect(orca.triggers.sessions).toBeDefined();
    expect(orca.guardrails).toBeDefined();
    expect(orca.modelPrices).toBeDefined();
    expect(orca.cloud.agents.providers).toBeDefined();
    expect(orca.cloud.apiResources).toBeDefined();
    expect(orca.cloud.catalog.kafka).toBeDefined();
    expect(orca.cloud.catalog.sinks).toBeDefined();
    expect(orca.cloud.catalog.sources).toBeDefined();
    expect(orca.cloud.connections).toBeDefined();
    expect(orca.cloud.functions).toBeDefined();
    expect(orca.cloud.health).toBeDefined();
    expect(orca.cloud.packages).toBeDefined();
    expect(orca.cloud.connectors.sinks).toBeDefined();
    expect(orca.cloud.connectors.sources).toBeDefined();
    expect(orca.cloud.connectors.kafka.plugins).toBeDefined();
    expect(orca.cloud.connectors.kafka.connectors).toBeDefined();
    expect(orca.discovery).toBeDefined();
    expect(orca.sessions.files).toBeDefined();
    expect(orca.memoryStores.memories).toBeDefined();
    expect(orca.memoryStores.memoryVersions).toBeDefined();
    expect('triggers' in orca.cloud).toBe(false);
  });

  it('requires baseURL', () => {
    expect(() => new Orca({})).toThrow(/baseURL is required/);
  });

  it('strips trailing slash from baseURL', () => {
    const orca = new Orca({ baseURL: 'https://example.test///' });
    expect(orca.baseURL).toBe('https://example.test');
  });
});
