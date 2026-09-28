// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Sessions resource.
 *
 * Requires an agent and environment to exist first, then:
 * create session → list → retrieve → update → archive.
 * All tests are gated on ORCA_TEST_API_KEY being present.
 */

import {
  describeIfCredentials,
  getTestClient,
  getTestPrefix,
  cleanupCreatedAgents,
  cleanupCreatedEnvironments,
} from './setup';
import type { Agent, Environment, Orca, Session } from '@orca-ae/orca-sdk';

describeIfCredentials('Sessions (integration)', () => {
  let client: Orca;
  let prefix: string;
  let agent: Agent;
  let env: Environment;
  let session: Session;

  beforeAll(async () => {
    client = getTestClient();
    prefix = getTestPrefix();
    [agent, env] = await Promise.all([
      client.agents.create({
        name: `${prefix}-sessions-agent`,
        model: 'claude-sonnet-4-6',
      }),
      client.environments.create({
        name: `${prefix}-sessions-env`,
      }),
    ]);
  });

  afterAll(async () => {
    // Archive session first, then underlying resources.
    if (session?.id) {
      try {
        await client.sessions.archive(session.id);
      } catch {
        // best-effort
      }
    }
    await Promise.all([
      cleanupCreatedAgents(client, prefix),
      cleanupCreatedEnvironments(client, prefix),
    ]);
  });

  test('create — returns a valid session', async () => {
    session = await client.sessions.create({
      agent: agent.id,
      environment_id: env.id,
      title: `${prefix}-session`,
    });

    expect(session.id).toBeTruthy();
    expect(session.type).toBe('session');
    expect(session.agent.id).toBe(agent.id);
  });

  test('list — created session appears in listing', async () => {
    const found: Session[] = [];
    for await (const s of client.sessions.list({ agent_id: agent.id })) {
      if (s.id === session.id) found.push(s);
    }
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  test('retrieve — fetches the session by id', async () => {
    const fetched = await client.sessions.retrieve(session.id);
    expect(fetched.id).toBe(session.id);
  });

  test('files.list — returns a page for the session', async () => {
    const page = await client.sessions.files.list(session.id, { limit: 10 });
    expect(Array.isArray(page.data)).toBe(true);
  });

  test('update — modifies title', async () => {
    const updated = await client.sessions.update(session.id, {
      title: `${prefix}-session-updated`,
    });
    expect(updated.title).toBe(`${prefix}-session-updated`);
    session = updated;
  });

  test('archive — soft-deletes the session', async () => {
    const archived = await client.sessions.archive(session.id);
    expect(archived.id).toBe(session.id);
    expect(archived.archived_at).toEqual(expect.any(String));
  });

  test('list (no archived) — archived session not visible by default', async () => {
    const found: Session[] = [];
    for await (const s of client.sessions.list({ agent_id: agent.id })) {
      if (s.id === session.id) found.push(s);
    }
    expect(found.length).toBe(0);
  });
});
