// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration test bootstrap.
 *
 * Reads credentials from environment variables and exports helpers used
 * across all integration test files.
 *
 * Set both ORCA_TEST_API_KEY and ORCA_TEST_BASE_URL to run the suites, or
 * neither to skip them. One without the other fails: a credential is only
 * meaningful for the deployment that issued it, so the suite never guesses
 * where to send one.
 */

jest.setTimeout(60_000);

import { ExtensionNotAvailableError, Orca } from '@runorca/orca-sdk';

// A whitespace-only value counts as unset.
const apiKey = process.env['ORCA_TEST_API_KEY']?.trim() ?? '';
const baseURL = process.env['ORCA_TEST_BASE_URL']?.trim() ?? '';
const hasAnyCredential = Boolean(apiKey || baseURL);

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Returns a configured `Orca` instance for integration tests.
 * Throws when only one of `ORCA_TEST_API_KEY` and `ORCA_TEST_BASE_URL` is set.
 */
export function getTestClient(): Orca {
  if (!apiKey || !baseURL) {
    throw new Error(
      'Set both ORCA_TEST_API_KEY and ORCA_TEST_BASE_URL to run the integration tests, or neither to ' +
        'skip them. Export them before running `yarn test:integration`.',
    );
  }

  return new Orca({ apiKey, baseURL, maxRetries: 0 });
}

// ---------------------------------------------------------------------------
// Run-scoped prefix
// ---------------------------------------------------------------------------

let _prefix: string | undefined;

/**
 * Returns a unique per-run prefix used to namespace created resources so
 * parallel runs and cleanup routines can identify them.
 *
 * E.g. `it-1715865600000-a1b2c3`
 */
export function getTestPrefix(): string {
  if (!_prefix) {
    _prefix = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return _prefix;
}

// ---------------------------------------------------------------------------
// Conditional test/describe wrappers
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for `test` / `it` that skips when neither
 * `ORCA_TEST_API_KEY` nor `ORCA_TEST_BASE_URL` is set. With only one set, the
 * test runs and `getTestClient()` fails it with a clear message.
 *
 * @example
 * ```ts
 * itIfCredentials('creates an agent', async () => { ... });
 * ```
 */
export const itIfCredentials = (hasAnyCredential ? test : test.skip).bind(test);

/**
 * Drop-in replacement for `describe` that skips the entire block when neither
 * `ORCA_TEST_API_KEY` nor `ORCA_TEST_BASE_URL` is set. With only one set, the
 * block runs and `getTestClient()` fails it with a clear message.
 *
 * @example
 * ```ts
 * describeIfCredentials('Agents', () => { ... });
 * ```
 */
export const describeIfCredentials = (hasAnyCredential ? describe : describe.skip).bind(describe);

/**
 * Checks and pre-warms extension discovery for cloud-only integration tests.
 */
export async function supportsExtension(client: Orca, group: string): Promise<boolean> {
  try {
    await client.ensureExtensionAvailable(group);
    return true;
  } catch (error) {
    if (error instanceof ExtensionNotAvailableError) return false;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Archives all agents whose names start with `prefix`.
 * Safe to call in `afterAll` — logs but does not throw on partial failures.
 */
export async function cleanupCreatedAgents(
  client: Orca,
  prefix: string,
): Promise<void> {
  try {
    for await (const agent of client.agents.list()) {
      if (agent.name.startsWith(prefix)) {
        try {
          await client.agents.archive(agent.id);
        } catch {
          // best-effort
        }
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Archives all environments whose names start with `prefix`.
 */
export async function cleanupCreatedEnvironments(
  client: Orca,
  prefix: string,
): Promise<void> {
  try {
    for await (const env of client.environments.list()) {
      if (env.name.startsWith(prefix)) {
        try {
          await client.environments.archive(env.id);
        } catch {
          // best-effort
        }
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Archives all vaults whose display_name starts with `prefix`.
 */
export async function cleanupCreatedVaults(
  client: Orca,
  prefix: string,
): Promise<void> {
  try {
    for await (const vault of client.vaults.list()) {
      if (vault.display_name?.startsWith(prefix)) {
        try {
          await client.vaults.archive(vault.id);
        } catch {
          // best-effort
        }
      }
    }
  } catch {
    // best-effort
  }
}
