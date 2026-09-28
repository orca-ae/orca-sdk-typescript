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

const base = '/apis/cloud.sn.io/v1/packages/function/trans%2Fform/v1';

const operations: OperationCase[] = [
  {
    name: 'list',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/packages/function',
    invoke: async (orca) => {
      await orca.cloud.packages.list('function', { headers: { 'X-Test-Header': 'list' } });
    },
  },
  {
    name: 'listVersions',
    method: 'GET',
    path: '/apis/cloud.sn.io/v1/packages/function/trans%2Fform',
    invoke: async (orca) => {
      await orca.cloud.packages.listVersions('function', 'trans/form', {
        headers: { 'X-Test-Header': 'versions' },
      });
    },
  },
  {
    name: 'download',
    method: 'GET',
    path: base,
    invoke: async (orca) => {
      await orca.cloud.packages.download('function', 'trans/form', 'v1', {
        headers: { 'X-Test-Header': 'download' },
      });
    },
  },
  {
    name: 'upload',
    method: 'POST',
    path: base,
    invoke: async (orca) => {
      await orca.cloud.packages.upload(
        'function',
        'trans/form',
        'v1',
        { metadata: { description: 'Transform' } },
        { headers: { 'X-Test-Header': 'upload' } },
      );
    },
  },
  {
    name: 'delete',
    method: 'DELETE',
    path: base,
    invoke: async (orca) => {
      await orca.cloud.packages.delete('function', 'trans/form', 'v1', {
        headers: { 'X-Test-Header': 'delete' },
      });
    },
  },
  {
    name: 'retrieveMetadata',
    method: 'GET',
    path: `${base}/metadata`,
    invoke: async (orca) => {
      await orca.cloud.packages.retrieveMetadata('function', 'trans/form', 'v1', {
        headers: { 'X-Test-Header': 'metadata' },
      });
    },
  },
  {
    name: 'updateMetadata',
    method: 'PUT',
    path: `${base}/metadata`,
    invoke: async (orca) => {
      await orca.cloud.packages.updateMetadata(
        'function',
        'trans/form',
        'v1',
        { description: 'Transform' },
        { headers: { 'X-Test-Header': 'update-metadata' } },
      );
    },
  },
];

describe('Packages operations', () => {
  it.each(operations)('$name maps to its contract operation', async ({ method, path, invoke }) => {
    const { orca, calls } = await makeCloudClient();
    await invoke(orca);

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe(method);
    expect((calls[0]!.init?.headers as Headers).get('X-Test-Header')).toBeTruthy();
  });

  it('encodes uploads as multipart form data', async () => {
    const { orca, calls } = await makeCloudClient();
    await orca.cloud.packages.upload('function', 'transform', 'v1', {
      metadata: { description: 'Transform' },
    });

    const form = calls[0]!.init?.body;
    expect(form).toBeInstanceOf(FormData);
    const metadata = (form as FormData).get('metadata');
    expect(metadata).toBeInstanceOf(File);
    expect((metadata as File).type).toBe('application/json');
    expect(JSON.parse(await (metadata as File).text())).toEqual({ description: 'Transform' });
    expect([...(form as FormData).keys()]).toEqual(['metadata']);
  });

  it.each([
    ['regular requests', async (orca: Orca) => await orca.cloud.packages.list('function')],
    [
      'multipart requests',
      async (orca: Orca) => await orca.cloud.packages.upload('function', 'transform', 'v1', {}),
    ],
  ])('gates %s before the package API request', async (_name, invoke) => {
    await assertCloudExtensionUnavailable(invoke);
  });
});
