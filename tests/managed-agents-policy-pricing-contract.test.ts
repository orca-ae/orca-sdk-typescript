// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AgentCreateParams, AgentUpdateParams, SessionAgentWithOverrides } from '../src';
import { Orca } from '../src/client';

type Assert<T extends true> = T;
type HasAll<T, Keys extends PropertyKey> = Exclude<Keys, keyof T> extends never ? true : false;

type _AgentCreateSupportsGuardrails = Assert<HasAll<AgentCreateParams, 'guardrail_ids'>>;
type _AgentUpdateSupportsGuardrails = Assert<HasAll<AgentUpdateParams, 'guardrail_ids'>>;
type _SessionOverridesSupportGuardrails = Assert<HasAll<SessionAgentWithOverrides, 'guardrail_ids'>>;

const extensionOperations: Record<string, (orca: Orca) => unknown> = {
  'discovery.policyGroupResources': (orca) => orca.discovery.policyGroupResources,
  'discovery.pricingGroupResources': (orca) => orca.discovery.pricingGroupResources,
  'guardrails.archive': (orca) => orca.guardrails.archive,
  'guardrails.create': (orca) => orca.guardrails.create,
  'guardrails.delete': (orca) => orca.guardrails.delete,
  'guardrails.get': (orca) => orca.guardrails.retrieve,
  'guardrails.list': (orca) => orca.guardrails.list,
  'guardrails.listTypes': (orca) => orca.guardrails.listTypes,
  'guardrails.update': (orca) => orca.guardrails.update,
  'modelPrices.get': (orca) => orca.modelPrices.retrieve,
  'modelPrices.list': (orca) => orca.modelPrices.list,
};

describe('managed-agents policy and pricing contract coverage', () => {
  const spec = readFileSync(resolve(__dirname, '../openapi/managed-agents-extensions.yaml'), 'utf8');
  const operationIDs = [
    ...spec.matchAll(
      /^\s+operationId:\s+((?:guardrails|modelPrices)\.\S+|discovery\.(?:policy|pricing)GroupResources)$/gm,
    ),
  ].map((match) => match[1]!);

  it('exposes every policy and pricing operationId in the vendored spec', () => {
    expect(Object.keys(extensionOperations).sort()).toEqual(operationIDs.sort());
  });

  it('maps every tracked operationId to a callable SDK method', () => {
    const orca = new Orca({ baseURL: 'https://api.example.test' });
    for (const accessor of Object.values(extensionOperations)) {
      expect(typeof accessor(orca)).toBe('function');
    }
  });
});
