// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Agents resource.
 *
 * Full CRUD round-trip: create → list → retrieve → update → archive → verify.
 * All tests are gated on ORCA_TEST_API_KEY being present.
 */

import {
  describeIfCredentials,
  getTestClient,
  getTestPrefix,
  cleanupCreatedAgents,
} from './setup';
import type { Agent, Orca } from '@runorca/orca-sdk';

describeIfCredentials('Agents (integration)', () => {
  let client: Orca;
  let prefix: string;
  let createdAgent: Agent;

  beforeAll(() => {
    client = getTestClient();
    prefix = getTestPrefix();
  });

  afterAll(async () => {
    await cleanupCreatedAgents(client, prefix);
  });

  test('create — returns a valid agent', async () => {
    const agent = await client.agents.create({
      name: `${prefix}-agent`,
      model: 'claude-sonnet-4-6',
      description: 'Integration test agent',
    });

    expect(agent.id).toBeTruthy();
    expect(agent.name).toBe(`${prefix}-agent`);
    expect(agent.type).toBe('agent');
    expect(agent.version).toBe(1);
    createdAgent = agent;
  });

  test('list — created agent appears in listing', async () => {
    const found: Agent[] = [];
    for await (const a of client.agents.list()) {
      if (a.name.startsWith(prefix)) {
        found.push(a);
      }
    }
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((a) => a.id === createdAgent.id)).toBe(true);
  });

  test('retrieve — fetches the agent by id', async () => {
    const agent = await client.agents.retrieve(createdAgent.id);
    expect(agent.id).toBe(createdAgent.id);
    expect(agent.name).toBe(createdAgent.name);
  });

  test('update — modifies description', async () => {
    const updated = await client.agents.update(createdAgent.id, {
      version: createdAgent.version,
      description: 'Updated by integration test',
    });
    expect(updated.description).toBe('Updated by integration test');
    expect(updated.version).toBeGreaterThan(createdAgent.version);
    createdAgent = updated;
  });

  test('archive — soft-deletes the agent', async () => {
    await expect(client.agents.archive(createdAgent.id)).resolves.toBeUndefined();
  });

  test('list (no archived) — archived agent not visible by default', async () => {
    const found: Agent[] = [];
    for await (const a of client.agents.list()) {
      if (a.id === createdAgent.id) {
        found.push(a);
      }
    }
    expect(found.length).toBe(0);
  });
});
