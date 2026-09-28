# Integration Tests

This directory contains integration tests that exercise the Orca SDK against a
real deployment of the engine.

## Running locally

```sh
# 1. Copy the example env file and fill in your deployment and key:
cp .env.example .env.local
# Edit .env.local and set ORCA_TEST_BASE_URL and ORCA_TEST_API_KEY

# 2. Export them (nothing loads .env.local automatically) and run the suite:
set -a; . ./.env.local; set +a
yarn test:integration
```

Set both `ORCA_TEST_API_KEY` and `ORCA_TEST_BASE_URL` to run the integration
tests, or neither to skip them; `yarn test` (unit tests) never needs them. One
without the other **fails** the suite with a clear message, because a
credential is only meaningful for the deployment that issued it.

## Required environment variables

| Variable             | Required | Description                                                  |
|----------------------|----------|--------------------------------------------------------------|
| `ORCA_TEST_API_KEY`  | Yes      | API key for the deployment under test.                       |
| `ORCA_TEST_BASE_URL` | Yes      | Host root of the deployment under test.                      |

## How CI runs them

* **Nightly (06:00 UTC)** — the `integration` workflow runs on a cron schedule
  against `main`.
* **On push to `main`** — the workflow also runs automatically.
* **Label-gated PRs** — add the `run-integration` label to a pull request to
  trigger the integration workflow for that branch.

The `ORCA_TEST_API_KEY` and `ORCA_TEST_BASE_URL` secrets are configured in the
GitHub repository settings and are **never** committed to the repository. When
both are absent (for example on pull requests from forks), the workflow skips
instead of failing; when only one is set, it fails. The workflow also masks the
deployment's host in the run logs.

## Cleanup expectations

Each test file's `afterAll` hook archives or deletes any resources it created,
using the unique per-run prefix (`it-<timestamp>-<random>`) to identify them.
If a test run crashes partway through, any orphaned resources can be identified
by their `it-*` prefix and cleaned up manually or by re-running the suite.
