// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Orca } from '../../../src/client';
import { assertCloudExtensionUnavailable, makeCloudClient } from './helpers';

type OperationCase = {
  name: string;
  method: string;
  path: string;
  invoke: (orca: Orca) => Promise<unknown>;
};

const operations: OperationCase[] = [
  {
    name: 'apiResources.list',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/',
    invoke: async (orca) => {
      await orca.cloud.apiResources.list({ headers: { 'X-Test-Header': 'api-resources' } });
    },
  },
  {
    name: 'health.check',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/health',
    invoke: async (orca) => {
      await orca.cloud.health.check({ headers: { 'X-Test-Header': 'health' } });
    },
  },
  {
    name: 'health.ready',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/health/ready',
    invoke: async (orca) => {
      await orca.cloud.health.ready({ headers: { 'X-Test-Header': 'ready' } });
    },
  },
  {
    name: 'health.live',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/health/live',
    invoke: async (orca) => {
      await orca.cloud.health.live({ headers: { 'X-Test-Header': 'live' } });
    },
  },
  ...(['kafka', 'sinks', 'sources'] as const).flatMap((kind): OperationCase[] => [
    {
      name: `catalog.${kind}.list`,
      method: 'GET',
      path: `/apis/cloud.sn.io/v1/catalog/${kind}`,
      invoke: async (orca) => {
        await orca.cloud.catalog[kind].list({ headers: { 'X-Test-Header': `${kind}-list` } });
      },
    },
    {
      name: `catalog.${kind}.retrieve`,
      method: 'GET',
      path: `/apis/cloud.sn.io/v1/catalog/${kind}/plug%2Fin`,
      invoke: async (orca) => {
        await orca.cloud.catalog[kind].retrieve('plug/in', {
          headers: { 'X-Test-Header': `${kind}-retrieve` },
        });
      },
    },
  ]),
];

describe('cloud discovery, health, and catalog operations', () => {
  it.each(operations)('$name maps to its contract operation', async ({ method, path, invoke }) => {
    const { orca, calls } = await makeCloudClient();
    await invoke(orca);

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe(method);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBeTruthy();
  });

  it.each([
    ['API resources', async (orca: Orca) => await orca.cloud.apiResources.list()],
    ['health', async (orca: Orca) => await orca.cloud.health.check()],
    ['catalog', async (orca: Orca) => await orca.cloud.catalog.kafka.list()],
  ])('gates %s before its API request', async (_name, invoke) => {
    await assertCloudExtensionUnavailable(invoke);
  });
});
