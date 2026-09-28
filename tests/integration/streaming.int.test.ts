// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Streaming (SSE events).
 *
 * Creates a session, sends a user.message event, then streams events and
 * asserts at least one event is yielded within the timeout window.
 * All tests are gated on ORCA_TEST_API_KEY being present.
 */

import {
  describeIfCredentials,
  getTestClient,
  getTestPrefix,
  cleanupCreatedAgents,
  cleanupCreatedEnvironments,
} from './setup';
import type { Agent, Environment, Orca, Session } from '@runorca/orca-sdk';

describeIfCredentials('Streaming (integration)', () => {
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
        name: `${prefix}-stream-agent`,
        model: 'claude-sonnet-4-6',
      }),
      client.environments.create({
        name: `${prefix}-stream-env`,
      }),
    ]);

    session = await client.sessions.create({
      agent: agent.id,
      environment_id: env.id,
      title: `${prefix}-stream-session`,
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

  test(
    'stream — receives at least one event after sending a user.message',
    async () => {
      // Send the user message to the session.
      await client.sessions.events.send(session.id, {
        events: [
          {
            type: 'user.message',
            content: [{ type: 'text', text: 'Hello, integration test!' }],
          },
        ],
      });

      const controller = new AbortController();
      // Abort after 30s to avoid hanging the test suite.
      const abortTimer = setTimeout(() => controller.abort(), 30_000);

      let eventCount = 0;
      try {
        const stream = await client.sessions.events.stream(
          session.id,
          {},
          { signal: controller.signal },
        );

        for await (const _event of stream) {
          eventCount++;
          // We got at least one event — that is all we need to verify.
          break;
        }
      } catch (err: unknown) {
        // An abort error is acceptable if we already counted events; it just
        // means we broke out before the server closed the stream.
        const isAbort =
          err instanceof Error &&
          (err.name === 'AbortError' || err.message.includes('abort'));
        if (!isAbort) throw err;
      } finally {
        clearTimeout(abortTimer);
        controller.abort();
      }

      expect(eventCount).toBeGreaterThanOrEqual(1);
    },
    35_000, // generous per-test timeout
  );
});
