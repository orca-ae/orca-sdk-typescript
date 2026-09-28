// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Orca } from '../../../src/client';
import { assertCloudExtensionUnavailable, makeCloudClient } from './helpers';

type ConnectorKind = 'sinks' | 'sources';
const connectorName = 'arch/ive';
type Action =
  | 'create'
  | 'retrieve'
  | 'update'
  | 'delete'
  | 'retrieveInstanceStatus'
  | 'retrieveStatus'
  | 'list'
  | 'restart'
  | 'restartInstance'
  | 'start'
  | 'startInstance'
  | 'stop'
  | 'stopInstance';

const actionContract: Record<Action, { method: string; suffix: string }> = {
  create: { method: 'POST', suffix: '' },
  retrieve: { method: 'GET', suffix: '' },
  update: { method: 'PUT', suffix: '' },
  delete: { method: 'DELETE', suffix: '' },
  retrieveInstanceStatus: { method: 'GET', suffix: '/instance%2F0/status' },
  retrieveStatus: { method: 'GET', suffix: '/status' },
  list: { method: 'GET', suffix: '' },
  restart: { method: 'POST', suffix: ':restart' },
  restartInstance: { method: 'POST', suffix: '/instance%2F0:restart' },
  start: { method: 'POST', suffix: ':start' },
  startInstance: { method: 'POST', suffix: '/instance%2F0:start' },
  stop: { method: 'POST', suffix: ':stop' },
  stopInstance: { method: 'POST', suffix: '/instance%2F0:stop' },
};

async function invoke(orca: Orca, kind: ConnectorKind, action: Action): Promise<void> {
  const options = { headers: { 'X-Test-Header': `${kind}-${action}` } };
  if (kind === 'sinks') {
    const resource = orca.cloud.connectors.sinks;
    switch (action) {
      case 'create':
        await resource.create(connectorName, { url: 'sink://archive@latest' }, options);
        return;
      case 'retrieve':
        await resource.retrieve(connectorName, options);
        return;
      case 'update':
        await resource.update(connectorName, { sinkConfig: { parallelism: 2 } }, options);
        return;
      case 'delete':
        await resource.delete(connectorName, options);
        return;
      case 'retrieveInstanceStatus':
        await resource.retrieveInstanceStatus(connectorName, 'instance/0', options);
        return;
      case 'retrieveStatus':
        await resource.retrieveStatus(connectorName, options);
        return;
      case 'list':
        await resource.list(options);
        return;
      case 'restart':
        await resource.restart(connectorName, options);
        return;
      case 'restartInstance':
        await resource.restartInstance(connectorName, 'instance/0', options);
        return;
      case 'start':
        await resource.start(connectorName, options);
        return;
      case 'startInstance':
        await resource.startInstance(connectorName, 'instance/0', options);
        return;
      case 'stop':
        await resource.stop(connectorName, options);
        return;
      case 'stopInstance':
        await resource.stopInstance(connectorName, 'instance/0', options);
        return;
    }
  }

  const resource = orca.cloud.connectors.sources;
  switch (action) {
    case 'create':
      await resource.create(connectorName, { url: 'source://events@latest' }, options);
      return;
    case 'retrieve':
      await resource.retrieve(connectorName, options);
      return;
    case 'update':
      await resource.update(connectorName, { sourceConfig: { parallelism: 2 } }, options);
      return;
    case 'delete':
      await resource.delete(connectorName, options);
      return;
    case 'retrieveInstanceStatus':
      await resource.retrieveInstanceStatus(connectorName, 'instance/0', options);
      return;
    case 'retrieveStatus':
      await resource.retrieveStatus(connectorName, options);
      return;
    case 'list':
      await resource.list(options);
      return;
    case 'restart':
      await resource.restart(connectorName, options);
      return;
    case 'restartInstance':
      await resource.restartInstance(connectorName, 'instance/0', options);
      return;
    case 'start':
      await resource.start(connectorName, options);
      return;
    case 'startInstance':
      await resource.startInstance(connectorName, 'instance/0', options);
      return;
    case 'stop':
      await resource.stop(connectorName, options);
      return;
    case 'stopInstance':
      await resource.stopInstance(connectorName, 'instance/0', options);
      return;
  }
}

const cases = (['sinks', 'sources'] as const).flatMap((kind) =>
  (Object.keys(actionContract) as Action[]).map((action) => {
    const base = `/apis/cloud.sn.io/v1/connectors/${kind}`;
    const namedBase = `${base}/arch%2Five`;
    return {
      name: `${kind}.${action}`,
      method: actionContract[action].method,
      path: action === 'list' ? base : `${namedBase}${actionContract[action].suffix}`,
      invoke: (orca: Orca) => invoke(orca, kind, action),
    };
  }),
);

describe('sink and source connector operations', () => {
  it.each(cases)('$name maps to its contract operation', async ({ method, path, invoke }) => {
    const { orca, calls } = await makeCloudClient();
    await invoke(orca);

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe(method);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBeTruthy();
  });

  it('encodes create and update payloads as multipart forms', async () => {
    const { orca, calls } = await makeCloudClient();

    await orca.cloud.connectors.sinks.create('archive', { sinkConfig: { connection: 'events' } });
    await orca.cloud.connectors.sinks.update('archive', { sinkConfig: { parallelism: 2 } });
    await orca.cloud.connectors.sources.create('events', { sourceConfig: { connection: 'events' } });
    await orca.cloud.connectors.sources.update('events', { sourceConfig: { parallelism: 2 } });

    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.init?.body instanceof FormData)).toBe(true);

    const jsonParts = [
      ['sinkConfig', { connection: 'events' }],
      ['sinkConfig', { parallelism: 2 }],
      ['sourceConfig', { connection: 'events' }],
      ['sourceConfig', { parallelism: 2 }],
    ] as const;
    for (const [index, [name, expected]] of jsonParts.entries()) {
      const form = calls[index]!.init!.body as FormData;
      const part = form.get(name);
      expect(part).toBeInstanceOf(File);
      expect((part as File).type).toBe('application/json');
      expect(JSON.parse(await (part as File).text())).toEqual(expected);
      expect([...form.keys()]).toEqual([name]);
    }
  });

  it.each([
    ['sink regular requests', async (orca: Orca) => await orca.cloud.connectors.sinks.list()],
    [
      'sink multipart requests',
      async (orca: Orca) => await orca.cloud.connectors.sinks.create('archive', {}),
    ],
    [
      'sink void requests',
      async (orca: Orca) => await orca.cloud.connectors.sinks.delete('archive'),
    ],
    ['source regular requests', async (orca: Orca) => await orca.cloud.connectors.sources.list()],
    [
      'source multipart requests',
      async (orca: Orca) => await orca.cloud.connectors.sources.create('events', {}),
    ],
    [
      'source void requests',
      async (orca: Orca) => await orca.cloud.connectors.sources.delete('events'),
    ],
  ])('gates %s before the connector API request', async (_name, invoke) => {
    await assertCloudExtensionUnavailable(invoke);
  });
});
