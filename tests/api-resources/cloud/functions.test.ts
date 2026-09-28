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

const functionPath = '/apis/cloud.sn.io/v1/functions/trans%2Fform';
const options = (name: string) => ({ headers: { 'X-Test-Header': name } });

const operations: OperationCase[] = [
  {
    name: 'create',
    method: 'POST',
    path: functionPath,
    invoke: async (orca) => {
      await orca.cloud.functions.create(
        'trans/form',
        { url: 'function://transform@latest' },
        options('create'),
      );
    },
  },
  {
    name: 'retrieve',
    method: 'GET',
    path: functionPath,
    invoke: async (orca) => {
      await orca.cloud.functions.retrieve('trans/form', options('retrieve'));
    },
  },
  {
    name: 'update',
    method: 'PUT',
    path: functionPath,
    invoke: async (orca) => {
      await orca.cloud.functions.update(
        'trans/form',
        { functionConfig: { parallelism: 2 } },
        options('update'),
      );
    },
  },
  {
    name: 'delete',
    method: 'DELETE',
    path: functionPath,
    invoke: async (orca) => {
      await orca.cloud.functions.delete('trans/form', options('delete'));
    },
  },
  {
    name: 'retrieveInstanceStats',
    method: 'GET',
    path: `${functionPath}/instance%2F0/stats`,
    invoke: async (orca) => {
      await orca.cloud.functions.retrieveInstanceStats('trans/form', 'instance/0', options('instance-stats'));
    },
  },
  {
    name: 'retrieveInstanceStatus',
    method: 'GET',
    path: `${functionPath}/instance%2F0/status`,
    invoke: async (orca) => {
      await orca.cloud.functions.retrieveInstanceStatus(
        'trans/form',
        'instance/0',
        options('instance-status'),
      );
    },
  },
  {
    name: 'retrieveState',
    method: 'GET',
    path: `${functionPath}/state/offset%2Fkey`,
    invoke: async (orca) => {
      await orca.cloud.functions.retrieveState('trans/form', 'offset/key', options('state'));
    },
  },
  {
    name: 'updateState',
    method: 'POST',
    path: `${functionPath}/state/offset%2Fkey`,
    invoke: async (orca) => {
      await orca.cloud.functions.updateState(
        'trans/form',
        'offset/key',
        { state: { numberValue: 10 } },
        options('update-state'),
      );
    },
  },
  {
    name: 'retrieveStats',
    method: 'GET',
    path: `${functionPath}/stats`,
    invoke: async (orca) => {
      await orca.cloud.functions.retrieveStats('trans/form', options('stats'));
    },
  },
  {
    name: 'retrieveStatus',
    method: 'GET',
    path: `${functionPath}/status`,
    invoke: async (orca) => {
      await orca.cloud.functions.retrieveStatus('trans/form', options('status'));
    },
  },
  {
    name: 'list',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/functions',
    invoke: async (orca) => {
      await orca.cloud.functions.list(options('list'));
    },
  },
  {
    name: 'restart',
    method: 'POST',
    path: `${functionPath}:restart`,
    invoke: async (orca) => {
      await orca.cloud.functions.restart('trans/form', options('restart'));
    },
  },
  {
    name: 'restartInstance',
    method: 'POST',
    path: `${functionPath}/instance%2F0:restart`,
    invoke: async (orca) => {
      await orca.cloud.functions.restartInstance('trans/form', 'instance/0', options('restart-instance'));
    },
  },
  {
    name: 'start',
    method: 'POST',
    path: `${functionPath}:start`,
    invoke: async (orca) => {
      await orca.cloud.functions.start('trans/form', options('start'));
    },
  },
  {
    name: 'startInstance',
    method: 'POST',
    path: `${functionPath}/instance%2F0:start`,
    invoke: async (orca) => {
      await orca.cloud.functions.startInstance('trans/form', 'instance/0', options('start-instance'));
    },
  },
  {
    name: 'stop',
    method: 'POST',
    path: `${functionPath}:stop`,
    invoke: async (orca) => {
      await orca.cloud.functions.stop('trans/form', options('stop'));
    },
  },
  {
    name: 'stopInstance',
    method: 'POST',
    path: `${functionPath}/instance%2F0:stop`,
    invoke: async (orca) => {
      await orca.cloud.functions.stopInstance('trans/form', 'instance/0', options('stop-instance'));
    },
  },
  {
    name: 'trigger',
    method: 'POST',
    path: `${functionPath}:trigger`,
    invoke: async (orca) => {
      await orca.cloud.functions.trigger('trans/form', { data: 'hello' }, options('trigger'));
    },
  },
];

describe('Functions operations', () => {
  it.each(operations)('$name maps to its contract operation', async ({ method, path, invoke }) => {
    const { orca, calls } = await makeCloudClient();
    await invoke(orca);

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe(method);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBeTruthy();
  });

  it('encodes function create, update, state, and trigger bodies as multipart forms', async () => {
    const { orca, calls } = await makeCloudClient();

    await orca.cloud.functions.create('transform', { functionConfig: { connection: 'events' } });
    await orca.cloud.functions.update('transform', { updateOptions: { 'update-auth-data': true } });
    await orca.cloud.functions.updateState('transform', 'offset', { state: { numberValue: 1 } });
    await orca.cloud.functions.trigger('transform', { data: 'hello' });

    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.init?.body instanceof FormData)).toBe(true);

    const jsonParts = [
      ['functionConfig', { connection: 'events' }],
      ['updateOptions', { 'update-auth-data': true }],
      ['state', { numberValue: 1 }],
    ] as const;
    for (const [index, [name, expected]] of jsonParts.entries()) {
      const form = calls[index]!.init!.body as FormData;
      const part = form.get(name);
      expect(part).toBeInstanceOf(File);
      expect((part as File).type).toBe('application/json');
      expect(JSON.parse(await (part as File).text())).toEqual(expected);
      expect([...form.keys()]).toEqual([name]);
    }

    expect((calls[3]!.init!.body as FormData).get('data')).toBe('hello');
  });

  it('preserves Headers instances for discovery and void operations', async () => {
    const { orca, calls } = await makeCloudClient();
    const headers = new Headers({ 'X-Test-Header': 'headers-instance' });

    await orca.cloud.functions.delete('transform', {
      defaultBaseURL: 'https://alternate.example.test',
      headers,
    });

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/apis',
      '/apis/cloud.sn.io/v1/functions/transform',
    ]);
    for (const call of calls) {
      const requestHeaders = call.init?.headers as Headers;
      expect(requestHeaders.get('X-Test-Header')).toBe('headers-instance');
      expect(requestHeaders.get('Accept')).toBe('*/*');
    }
  });

  it.each([
    ['regular requests', async (orca: Orca) => await orca.cloud.functions.list()],
    ['void requests', async (orca: Orca) => await orca.cloud.functions.delete('transform')],
    [
      'multipart requests',
      async (orca: Orca) => await orca.cloud.functions.create('transform', { url: 'function://latest' }),
    ],
  ])('gates %s before the function API request', async (_name, invoke) => {
    await assertCloudExtensionUnavailable(invoke);
  });
});
