#!/usr/bin/env -S npm run tsn -T
// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Streaming events example.
 *
 * Creates an agent, environment, and session, sends a user.message event,
 * then opens an SSE stream and logs every event. Breaks on
 * `session.status_idle` or after 30 seconds. Archives the session and agent
 * at the end.
 *
 * Required environment variables:
 *   ORCA_API_KEY  — Bearer token for the Orca API
 *   ORCA_BASE_URL — Base URL, e.g. https://api.orca.example
 */

import Orca, { OrcaError } from '@orca-ae/orca-sdk';

async function main(): Promise<void> {
  const orca = new Orca({
    apiKey: process.env['ORCA_API_KEY'],
    baseURL: process.env['ORCA_BASE_URL'],
  });

  // Bootstrap: agent + environment + session
  console.log('Creating environment...');
  const environment = await orca.environments.create({ name: 'streaming-example-env' });

  console.log('Creating agent...');
  const agent = await orca.agents.create({
    model: 'claude-sonnet-4-6',
    name: 'Streaming Example Agent',
  });

  console.log('Creating session...');
  const session = await orca.sessions.create({
    agent: agent.id,
    environment_id: environment.id as string,
  });
  console.log('Session:', session.id);

  // Send a user message
  console.log('\nSending user.message event...');
  await orca.sessions.events.send(session.id, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: 'Hello, what can you help me with?' }],
      },
    ],
  });

  // Stream events with a 30-second deadline
  console.log('\nOpening SSE stream...');
  const deadline = Date.now() + 30_000;
  const stream = await orca.sessions.events.stream(session.id);

  for await (const event of stream) {
    console.log('[event]', event.type, JSON.stringify(event));
    if (event.type === 'session.status_idle') {
      console.log('Session reached idle — stopping.');
      break;
    }
    if (Date.now() > deadline) {
      console.log('30-second deadline reached — stopping.');
      break;
    }
  }

  // Clean up
  console.log('\nArchiving session...');
  await orca.sessions.archive(session.id);

  console.log('Archiving agent...');
  await orca.agents.archive(agent.id);

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  if (err instanceof OrcaError) {
    console.error('OrcaError:', err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
