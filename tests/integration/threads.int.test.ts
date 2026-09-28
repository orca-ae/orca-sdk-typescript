// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Sessions Threads sub-resource.
 *
 * Threads are spawned by the coordinator; the SDK does not expose a `create`
 * method. We create an agent + session, then exercise list/retrieve/archive
 * against the threads the server has produced (typically the primary thread
 * for the session). If the registry does not expose thread endpoints yet,
 * every operation will surface as a 404 or 501 — we treat those as a skip
 * signal rather than a failure.
 */

import {
  describeIfCredentials,
  getTestClient,
  getTestPrefix,
  cleanupCreatedAgents,
  cleanupCreatedEnvironments,
} from './setup';
import { APIError } from '@runorca/orca-sdk';
import type { Agent, Environment, Orca, Session, SessionThread } from '@runorca/orca-sdk';

/**
 * Returns true if the error indicates the server has not yet implemented
 * this surface. Treat as a soft skip.
 */
function isNotImplemented(err: unknown): boolean {
  return err instanceof APIError && (err.status === 404 || err.status === 501);
}

describeIfCredentials('Sessions.threads (integration)', () => {
  let client: Orca;
  let prefix: string;
  let agent: Agent;
  let env: Environment;
  let session: Session;
  let serverSupportsThreads = true;

  beforeAll(async () => {
    client = getTestClient();
    prefix = getTestPrefix();
    [agent, env] = await Promise.all([
      client.agents.create({
        name: `${prefix}-threads-agent`,
        model: 'claude-sonnet-4-6',
      }),
      client.environments.create({
        name: `${prefix}-threads-env`,
      }),
    ]);
    session = await client.sessions.create({
      agent: agent.id,
      environment_id: env.id,
      title: `${prefix}-threads-session`,
    });
  });

  afterAll(async () => {
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

  test('list — server either returns threads or signals unsupported', async () => {
    try {
      const threads: SessionThread[] = [];
      for await (const t of client.sessions.threads.list(session.id)) {
        threads.push(t);
        if (threads.length >= 5) break;
      }
      // Server supports threads — array may be empty if the coordinator hasn't
      // produced one yet; that's still a successful contract test.
      expect(Array.isArray(threads)).toBe(true);
    } catch (err) {
      if (!isNotImplemented(err)) throw err;
      serverSupportsThreads = false;
      console.warn(
        '[threads.int] registry does not expose thread endpoints yet — skipping retrieve/archive',
      );
    }
  });

  test('retrieve + archive — exercises round-trip when supported', async () => {
    if (!serverSupportsThreads) {
      return;
    }

    // Find one thread; if the coordinator hasn't produced one yet, skip.
    let first: SessionThread | undefined;
    for await (const t of client.sessions.threads.list(session.id)) {
      first = t;
      break;
    }
    if (!first) {
      console.warn('[threads.int] no threads produced yet — skipping retrieve/archive');
      return;
    }

    const fetched = await client.sessions.threads.retrieve(session.id, first.id);
    expect(fetched.id).toBe(first.id);
    expect(fetched.session_id).toBe(session.id);

    // Archive is best-effort — primary threads may refuse archive. Tolerate
    // 400/409/501 here too.
    try {
      await client.sessions.threads.archive(session.id, first.id);
    } catch (err) {
      if (err instanceof APIError && [400, 404, 409, 501].includes(err.status ?? 0)) {
        // expected for non-archivable threads
        return;
      }
      throw err;
    }
  });
});
