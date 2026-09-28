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

const connectorPath = '/apis/cloud.sn.io/v1/connectors/kafka/connectors/events%2Fprimary';
const options = (name: string) => ({ headers: { 'X-Test-Header': name } });

const operations: OperationCase[] = [
  {
    name: 'kafka.health',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connectors/kafka/health',
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.health(options('health'));
    },
  },
  {
    name: 'kafka.serverInfo',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connectors/kafka',
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.serverInfo(options('server-info'));
    },
  },
  {
    name: 'plugins.retrieveConfig',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connectors/kafka/connector-plugins/plugin%2Fname/config',
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.plugins.retrieveConfig('plugin/name', options('plugin-config'));
    },
  },
  {
    name: 'plugins.list',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connectors/kafka/connector-plugins',
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.plugins.list({ connectorsOnly: false }, options('plugins-list'));
    },
  },
  {
    name: 'plugins.listCatalog',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connectors/kafka/connector-plugins/catalog',
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.plugins.listCatalog(options('plugins-catalog'));
    },
  },
  {
    name: 'connectors.retrieveOffsets',
    method: 'GET',
    path: `${connectorPath}/offsets`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.retrieveOffsets('events/primary', options('offsets'));
    },
  },
  {
    name: 'connectors.resetOffsets',
    method: 'DELETE',
    path: `${connectorPath}/offsets`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.resetOffsets('events/primary', options('reset-offsets'));
    },
  },
  {
    name: 'connectors.updateOffsets',
    method: 'PATCH',
    path: `${connectorPath}/offsets`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.updateOffsets(
        'events/primary',
        { offsets: [] },
        options('update-offsets'),
      );
    },
  },
  {
    name: 'connectors.list',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/connectors/kafka/connectors',
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.list(options('list'));
    },
  },
  {
    name: 'connectors.create',
    method: 'POST',
    path: '/apis/cloud.sn.io/v1/connectors/kafka/connectors',
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.create(
        { name: 'events', config: { 'connector.class': 'Example' } },
        options('create'),
      );
    },
  },
  {
    name: 'connectors.retrieve',
    method: 'GET',
    path: connectorPath,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.retrieve('events/primary', options('retrieve'));
    },
  },
  {
    name: 'connectors.delete',
    method: 'DELETE',
    path: connectorPath,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.delete('events/primary', options('delete'));
    },
  },
  {
    name: 'connectors.retrieveActiveTopics',
    method: 'GET',
    path: `${connectorPath}/topics`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.retrieveActiveTopics('events/primary', options('topics'));
    },
  },
  {
    name: 'connectors.retrieveConfig',
    method: 'GET',
    path: `${connectorPath}/config`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.retrieveConfig('events/primary', options('config'));
    },
  },
  {
    name: 'connectors.updateConfig',
    method: 'PUT',
    path: `${connectorPath}/config`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.updateConfig(
        'events/primary',
        { 'tasks.max': '2' },
        options('update-config'),
      );
    },
  },
  {
    name: 'connectors.retrieveStatus',
    method: 'GET',
    path: `${connectorPath}/status`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.retrieveStatus('events/primary', options('status'));
    },
  },
  {
    name: 'connectors.listTasks',
    method: 'GET',
    path: `${connectorPath}/tasks`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.listTasks('events/primary', options('tasks'));
    },
  },
  {
    name: 'connectors.retrieveTaskStatus',
    method: 'GET',
    path: `${connectorPath}/tasks/3/status`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.retrieveTaskStatus(
        'events/primary',
        3,
        options('task-status'),
      );
    },
  },
  {
    name: 'connectors.retrieveTasksConfig',
    method: 'GET',
    path: `${connectorPath}/tasks-config`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.retrieveTasksConfig(
        'events/primary',
        options('tasks-config'),
      );
    },
  },
  {
    name: 'connectors.pause',
    method: 'PUT',
    path: `${connectorPath}:pause`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.pause('events/primary', options('pause'));
    },
  },
  {
    name: 'connectors.resetActiveTopics',
    method: 'PUT',
    path: `${connectorPath}/topics:reset`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.resetActiveTopics(
        'events/primary',
        options('reset-topics'),
      );
    },
  },
  {
    name: 'connectors.restart',
    method: 'POST',
    path: `${connectorPath}:restart`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.restart(
        'events/primary',
        { includeTasks: true, onlyFailed: true },
        options('restart'),
      );
    },
  },
  {
    name: 'connectors.restartTask',
    method: 'POST',
    path: `${connectorPath}/tasks/3/restart`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.restartTask('events/primary', 3, options('restart-task'));
    },
  },
  {
    name: 'connectors.resume',
    method: 'PUT',
    path: `${connectorPath}:resume`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.resume('events/primary', options('resume'));
    },
  },
  {
    name: 'connectors.stop',
    method: 'PUT',
    path: `${connectorPath}:stop`,
    invoke: async (orca) => {
      await orca.cloud.connectors.kafka.connectors.stop('events/primary', options('stop'));
    },
  },
];

describe('Kafka Connect operations', () => {
  it.each(operations)('$name maps to its contract operation', async ({ method, path, invoke }) => {
    const { orca, calls } = await makeCloudClient();
    await invoke(orca);

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe(method);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBeTruthy();
  });

  it('forwards plugin and restart query parameters', async () => {
    const { orca, calls } = await makeCloudClient();

    await orca.cloud.connectors.kafka.plugins.list({ connectorsOnly: false });
    await orca.cloud.connectors.kafka.connectors.restart('events', {
      includeTasks: true,
      onlyFailed: true,
    });

    expect(new URL(calls[0]!.url).searchParams.get('connectorsOnly')).toBe('false');
    expect(new URL(calls[1]!.url).searchParams.get('includeTasks')).toBe('true');
    expect(new URL(calls[1]!.url).searchParams.get('onlyFailed')).toBe('true');
  });

  it('forwards connector JSON request bodies without reshaping', async () => {
    const { orca, calls } = await makeCloudClient();

    await orca.cloud.connectors.kafka.connectors.updateOffsets('events', { offsets: [] });
    await orca.cloud.connectors.kafka.connectors.create({
      name: 'events',
      initial_state: 'PAUSED',
    });
    await orca.cloud.connectors.kafka.connectors.updateConfig('events', { 'tasks.max': '2' });

    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({ offsets: [] });
    expect(JSON.parse(calls[1]!.init?.body as string)).toEqual({
      name: 'events',
      initial_state: 'PAUSED',
    });
    expect(JSON.parse(calls[2]!.init?.body as string)).toEqual({ 'tasks.max': '2' });
  });

  it.each([
    ['worker requests', async (orca: Orca) => await orca.cloud.connectors.kafka.health()],
    ['plugin requests', async (orca: Orca) => await orca.cloud.connectors.kafka.plugins.list()],
    [
      'connector void requests',
      async (orca: Orca) => await orca.cloud.connectors.kafka.connectors.delete('events'),
    ],
  ])('gates %s before the Kafka API request', async (_name, invoke) => {
    await assertCloudExtensionUnavailable(invoke);
  });
});
