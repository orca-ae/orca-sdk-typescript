#!/usr/bin/env -S npm run tsn -T
// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Quickstart example.
 *
 * Creates an agent and environment, lists agents (paginated), then archives
 * the agent at the end.
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

  // Create an environment
  console.log('Creating environment...');
  const environment = await orca.environments.create({
    name: 'quickstart-env',
  });
  console.log('Environment:', environment);

  // Create an agent
  console.log('\nCreating agent...');
  const agent = await orca.agents.create({
    model: 'claude-sonnet-4-6',
    name: 'Quickstart Agent',
    description: 'Created by the quickstart example.',
  });
  console.log('Agent created:', agent.id);

  // List agents (paginated)
  console.log('\nListing agents (first page)...');
  let count = 0;
  for await (const a of orca.agents.list()) {
    console.log(' -', a.id, a.name);
    count++;
    if (count >= 5) {
      console.log('  (stopping after 5)');
      break;
    }
  }

  // Archive the agent
  console.log('\nArchiving agent...');
  await orca.agents.archive(agent.id);
  console.log('Agent archived:', agent.id);

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
