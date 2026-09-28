// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — policy and pricing extension groups.
 */

import {
  POLICY_EXTENSION_GROUP,
  PRICING_EXTENSION_GROUP,
  type Guardrail,
  type ModelPrice,
  type Orca,
} from '@runorca/orca-sdk';
import { describeIfCredentials, getTestClient, getTestPrefix, supportsExtension } from './setup';

describeIfCredentials('Policy and pricing extensions (integration)', () => {
  let client: Orca;
  let hasPolicy = false;
  let hasPricing = false;
  let createdGuardrailId: string | undefined;

  beforeAll(async () => {
    client = getTestClient();
    [hasPolicy, hasPricing] = await Promise.all([
      supportsExtension(client, POLICY_EXTENSION_GROUP),
      supportsExtension(client, PRICING_EXTENSION_GROUP),
    ]);
  });

  afterAll(async () => {
    if (!createdGuardrailId) return;
    try {
      await client.guardrails.delete(createdGuardrailId);
    } catch {
      // best-effort cleanup
    }
  });

  it('discovers and exercises the Guardrail lifecycle', async () => {
    if (!hasPolicy) return;

    const resources = await client.discovery.policyGroupResources();
    expect(resources.resources.some((resource) => resource.name === 'guardrails')).toBe(true);

    const types = await client.guardrails.listTypes();
    expect(Array.isArray(types.data)).toBe(true);

    const created = await client.guardrails.create({
      name: `${getTestPrefix()}-guardrail`,
      rule: { kind: 'expression', expression: 'true', on_false: 'deny' },
      metadata: { source: 'sdk-integration' },
    });
    createdGuardrailId = created.id;

    const retrieved = await client.guardrails.retrieve(created.id);
    expect(retrieved.id).toBe(created.id);

    const updated = await client.guardrails.update(created.id, { enabled: false });
    expect(updated.enabled).toBe(false);

    const listed: Guardrail[] = [];
    for await (const guardrail of client.guardrails.list({ limit: 10 })) {
      listed.push(guardrail);
    }
    expect(listed.some((guardrail) => guardrail.id === created.id)).toBe(true);

    const archived = await client.guardrails.archive(created.id);
    expect(archived.archived_at).not.toBeNull();

    const deleted = await client.guardrails.delete(created.id);
    expect(deleted).toEqual({ id: created.id, type: 'guardrail_deleted' });
    createdGuardrailId = undefined;
  });

  it('discovers and lists effective model prices', async () => {
    if (!hasPricing) return;

    const resources = await client.discovery.pricingGroupResources();
    expect(resources.resources.some((resource) => resource.name === 'modelprices')).toBe(true);

    const prices: ModelPrice[] = [];
    for await (const price of client.modelPrices.list({ limit: 10 })) {
      prices.push(price);
    }
    expect(Array.isArray(prices)).toBe(true);

    if (prices[0]) {
      const retrieved = await client.modelPrices.retrieve(prices[0].model_id, {
        provider: prices[0].provider,
      });
      expect(retrieved).toEqual(prices[0]);
    }
  });
});
