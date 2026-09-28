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
    name: 'list',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connections',
    invoke: async (orca) => {
      await orca.cloud.connections.list({ headers: { 'X-Test-Header': 'list' } });
    },
  },
  {
    name: 'create',
    method: 'POST',
    path: '/apis/cloud.sn.io/v1/connections',
    invoke: async (orca) => {
      await orca.cloud.connections.create(
        { name: 'events', spec: { type: 'kafka' } },
        { headers: { 'X-Test-Header': 'create' } },
      );
    },
  },
  {
    name: 'retrieve',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connections/events%2Fprimary',
    invoke: async (orca) => {
      await orca.cloud.connections.retrieve('events/primary', {
        headers: { 'X-Test-Header': 'retrieve' },
      });
    },
  },
  {
    name: 'update',
    method: 'PUT',
    path: '/apis/cloud.sn.io/v1/connections/events',
    invoke: async (orca) => {
      await orca.cloud.connections.update(
        'events',
        { spec: { type: 'kafka' } },
        { headers: { 'X-Test-Header': 'update' } },
      );
    },
  },
  {
    name: 'delete',
    method: 'DELETE',
    path: '/apis/cloud.sn.io/v1/connections/events',
    invoke: async (orca) => {
      await orca.cloud.connections.delete('events', { headers: { 'X-Test-Header': 'delete' } });
    },
  },
  {
    name: 'test',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connections/events:test',
    invoke: async (orca) => {
      await orca.cloud.connections.test('events', { headers: { 'X-Test-Header': 'test' } });
    },
  },
  {
    name: 'validate',
    method: 'POST',
    path: '/apis/cloud.sn.io/v1/connections/validate',
    invoke: async (orca) => {
      await orca.cloud.connections.validate(
        { name: 'events', spec: { type: 'kafka' } },
        { headers: { 'X-Test-Header': 'validate' } },
      );
    },
  },
];

describe('Connections operations', () => {
  it.each(operations)('$name maps to its contract operation', async ({ method, path, invoke }) => {
    const { orca, calls } = await makeCloudClient();
    await invoke(orca);

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe(method);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBeTruthy();
  });

  it('sends the connection body without reshaping wire fields', async () => {
    const { orca, calls } = await makeCloudClient();
    await orca.cloud.connections.create({
      name: 'events',
      clusterRef: 'cluster-a',
      spec: {
        type: 'kafka',
        kafka: {
          bootstrapServers: 'broker:9092',
          schemaRegistry: {
            url: 'https://schemas.example.test',
            authConfig: { basicAuthConfig: { secretName: 'schema-registry-auth' } },
          },
        },
      },
    });

    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      name: 'events',
      clusterRef: 'cluster-a',
      spec: {
        type: 'kafka',
        kafka: {
          bootstrapServers: 'broker:9092',
          schemaRegistry: {
            url: 'https://schemas.example.test',
            authConfig: { basicAuthConfig: { secretName: 'schema-registry-auth' } },
          },
        },
      },
    });
  });

  it('gates connections before their API request', async () => {
    await assertCloudExtensionUnavailable(async (orca) => await orca.cloud.connections.list());
  });
});
