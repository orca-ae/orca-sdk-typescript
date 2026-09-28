// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Orca } from '../src/client';

const triggerOperations: Record<string, (orca: Orca) => unknown> = {
  'triggers.create': (orca) => orca.triggers.create,
  'triggers.list': (orca) => orca.triggers.list,
  'triggers.get': (orca) => orca.triggers.retrieve,
  'triggers.update': (orca) => orca.triggers.update,
  'triggers.delete': (orca) => orca.triggers.delete,
  'triggers.pause': (orca) => orca.triggers.pause,
  'triggers.sessions': (orca) => orca.triggers.sessions.list,
  'triggers.unpause': (orca) => orca.triggers.unpause,
};

describe('managed-agents Trigger contract coverage', () => {
  const spec = readFileSync(resolve(__dirname, '../openapi/managed-agents.yaml'), 'utf8');
  const operationIDs = [...spec.matchAll(/^\s+operationId:\s+(triggers\.\S+)$/gm)].map((match) => match[1]!);

  it('exposes every Trigger operationId in the core spec', () => {
    expect(Object.keys(triggerOperations).sort()).toEqual(operationIDs.sort());
  });

  it('maps every Trigger operationId to a callable SDK method', () => {
    const orca = new Orca({ baseURL: 'https://api.example.test' });
    for (const accessor of Object.values(triggerOperations)) {
      expect(typeof accessor(orca)).toBe('function');
    }
  });
});
