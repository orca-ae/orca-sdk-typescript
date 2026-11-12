# End-to-end tests

These tests exercise the built SDK directly against a Helm-installed Managed
Agents stack with a workspace API key, using `e2e-managed-agents.yml`. The
proprietary hosted provider topology is not part of this repository's E2E suite.

The workflow resolves the paired Managed Agents Registry and Harness release
configured in `dependencies.env` to platform-specific digests. Their shared OCI
source revision selects the matching Helm chart and deterministic Anthropic/MCP
fixture. The chart-pinned AI Gateway version remains independent.

The stack uses [RustFS](https://github.com/rustfs/rustfs) for S3-compatible
object storage, from `object-store.yaml`: `rustfs/rustfs:1.0.0` pinned by digest,
plus a Job on the same image that creates the engine's bucket with SigV4 `curl`
requests. MinIO's server and client images stopped allowing anonymous pulls, which
broke E2E.

`sdk.test.cjs` loads the compiled CommonJS package from `dist/`, so E2E
validates the distributable SDK rather than Jest's source-module mapping. The
scenarios cover extension discovery, environment and agent lifecycle,
multipart file upload, pagination, session creation, deterministic Harness
execution, event polling, SSE replay, core Trigger lifecycle/session-history,
Guardrail lifecycle and Agent/Session attachment, seeded Model Price reads, and
cleanup. They also verify that hosted-extension calls fail with
`ExtensionNotAvailableError` when the engine does not advertise `cloud.sn.io`.
Hosted-extension API behavior remains covered by mocked unit tests.

Policy/pricing discovery and scenarios are required,
including Guardrail type discovery, archive/delete cleanup, and provider-qualified
Model Price retrieval. Missing extension groups fail the suite.

Session cleanup uses `POST /v1/sessions/{id}/archive` and checks `archived_at`.

The workflow uses the configured source and image access settings. It runs on pushes to
`main`, nightly schedules, and manual dispatches selecting `main` in the canonical repository.
Each run checks out its triggering commit SHA on a fresh GitHub-hosted runner without package
cache reuse. Missing source configuration explicitly skips the job.

Pull requests retain lint, unit tests and builds. Full-stack E2E runs after merge.
Repository administration and access configuration are managed separately.

The workflow uploads no artifacts, because GitHub does not mask those.

To run the SDK scenarios against an already reachable deployment:

```bash
yarn build
ORCA_BASE_URL=http://localhost:8080 \
ORCA_E2E_API_KEY=... \
ORCA_E2E_EXPECT_EXECUTION=true \
yarn test:e2e
```

The direct topology sends `ORCA_E2E_API_KEY` as `x-api-key`. The
deployment scripts require Bash, Docker Buildx, Kind, kubectl, Helm, jq, yq,
and OpenSSL, plus read access to the engine source revision the images were
built from, which carries the Helm chart.
