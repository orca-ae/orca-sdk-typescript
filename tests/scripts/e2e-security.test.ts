// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs';
import * as path from 'node:path';

const workflow = fs.readFileSync(
  path.resolve(__dirname, '../../.github/workflows/e2e-managed-agents.yml'),
  'utf8',
);

function job(name: string): string {
  const block = workflow.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [\\w-]+:|$(?![\\s\\S]))`, 'm'));
  if (!block) throw new Error(`Missing ${name} job`);
  return block[1]!;
}

const trustedGate =
  "github.repository == 'orca-ae/orca-sdk-typescript' && " +
  "github.ref == 'refs/heads/main' && " +
  "(github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch')";

describe('credential-bearing E2E boundary', () => {
  it('has no PR trigger and pins the main push trigger', () => {
    const triggers = workflow.split('\non:\n')[1]!.split('\npermissions:')[0]!;
    expect(triggers).not.toMatch(/pull_request|workflow_run|issue_comment/);
    expect(triggers).toContain('push:\n    branches: [main]');
    expect(triggers).toContain('schedule:');
    expect(triggers).toContain('workflow_dispatch:');
  });

  it.each(['secret-gate', 'e2e'])('%s rejects PRs and non-main dispatches before steps', (name) => {
    const block = job(name);
    const condition = block
      .match(/    if: >-\n([\s\S]*?)(?=^    \S)/m)![1]!
      .trim()
      .replace(/\s+/g, ' ');
    expect(condition).toBe(
      name === 'e2e' ? `needs.secret-gate.outputs.enabled == 'true' && ${trustedGate}` : trustedGate,
    );
    expect(block).toContain('runs-on: ubuntu-latest');
    expect(block).not.toContain('vars.E2E_RUNNER');
  });

  it('pins checkout to the triggering SHA without persistent credentials or restored caches', () => {
    expect(job('e2e')).toContain('ref: ${{ github.sha }}\n          persist-credentials: false');
    expect(job('e2e')).not.toMatch(/cache:|actions\/cache/);
  });

  it('preserves secretless PR lint, unit tests and build', () => {
    const ci = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('pull_request:');
    expect(ci).not.toContain('secrets.');
    for (const check of ['yarn lint', 'yarn test', 'yarn build']) expect(ci).toContain(check);
  });
});
