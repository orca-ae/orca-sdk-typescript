# Changelog

## Unreleased

### Changed

- Releases now use Release Please: conventional commits update a release PR, and merging it builds and publishes the tagged SDK publicly to npmjs.org using Trusted Publishing. The scheduled RC and manual promotion workflows are replaced by a single release workflow with explicit publication retries. `package.json` is the version source of truth; the redundant `VERSION` file is removed.

### Fixed

- The exported SDK version and User-Agent now match `package.json`, including release-candidate versions. Lint, test, and build synchronize the version automatically, and the build verifies both CommonJS and ESM exports against the package version.

### Breaking

This is the release that makes the SDK work against a self-hosted engine deployment. Previously `@orca-ae/orca-sdk` hardcoded `/v1/registry/...` in every path; the open-source engine serves `/v1/...`, so `ORCA_BASE_URL` pointed at one 404d on every call.

- **`baseURL` is now the host root.** The client appends the full path, including its own `/v1` or `/apis/...` prefix (`ORCA_BASE_URL=https://host` → `GET {base}/v1/agents`). A `baseURL` pathname ending in `/v1/registry`, `/v1`, or `/api/v1` (what was previously required, or suggested by docs) is detected, stripped, and logs a deprecation warning — existing callers keep working, but should update their configuration. Detection applies only to the parsed pathname, so a hostname such as `http://v1` is left intact. The `/api/v1` case strips the whole suffix, not just the trailing `/v1`: stripping only `/v1` would leave core paths resolving (via the `/api/v1/*` alias) while silently breaking every `/apis/...` extension call; stripping the full suffix leaves the actual host root, where both resolve.
- **Core paths dropped the `/registry` infix**: `/v1/registry/agents` → `/v1/agents`, and likewise for every other core resource (sessions, environments, files, skills, vaults, memory stores). `/v1/registry/*` keeps working as a deprecated alias on the hosted distribution, but the SDK no longer targets it directly.
- **Triggers are now core operations at `orca.triggers`.** The unpublished `orca.cloud.triggers` and `/apis/cloud.sn.io/v1/agenttriggers` surface is removed. Core lifecycle uses create/list/retrieve/update/delete/pause/unpause plus `.sessions.list`; updates are `POST`, actions use `/pause` and `/unpause`, and delete returns `DeletedTrigger`.
- **`orca.agents.providers` moved to `orca.cloud.agents.providers`** (same `list`/`retrieve` methods), for the same reason — it also fixes a route-ambiguity defect on the hosted distribution, where `GET /v1/registry/agents/providers` and `GET /v1/registry/agents/{agent_id}` shared a route shape.
- **`orca.cloud.*` methods throw `ExtensionNotAvailableError`** when called against a deployment that doesn't advertise `cloud.sn.io` via `GET /apis` (e.g. the open-source engine) — not a raw 404. Gated lazily, using per-call deployment and authentication overrides, and cached per effective deployment URL. Concurrent probes with explicit request controls remain isolated so one caller's authentication, timeout, or abort cannot affect another; see `AGENTS.md` §5.
- **Removed the write-only `beta_version`/`betaVersion` body field** from agent, environment, memory store, session, vault, vault-credential, and **session-resource** (`orca.sessions.resources.add`/`.update`) create/update params. No core or cloud spec ever defined it as a request-body field (only as the `orca-beta` request header, which every method already accepts via `RequestOptions.headers`), and sending it in the body causes a 400 from the hosted distribution's skill provider. Pass `{ headers: { 'orca-beta': '<value>' } }` instead.
- **Removed the registry-only top-level `provider` request parameter** from core create/list APIs. Provider-qualified models and credential authentication retain their nested, spec-defined `provider` fields.
- **Core request types now apply `managed-agents-deployment.overlay.yaml`.** Environment create/update no longer expose the deployment-unsupported flat `packages`, `networking`, `image`, or `target` fields; use `config` for portable environment settings. Agent, session, file, memory-store, memory-version, and Skill lists omit the filters still removed by the deployment overlay, and the unsupported Agent delete operation remains absent.
- **Session-file pagination now uses the core contract's ID cursors.** `SessionFileListParams.page` is replaced by `after_id`/`before_id`. The four methods keep their call shape but use the canonical `/v1/sessions/{session_id}/files...` operations now implemented by both backends. `SessionFile.id`, `filename`, `mime_type`, `size_bytes`, and `created_at` are typed as required, and `delete` returns `DeletedSessionFile` instead of `void`.
- **Core request types now enforce required payloads.** Skill uploads use `files: Uploadable[]`; memory creation requires `path` and `content`; vault creation requires `display_name`; credential creation requires a typed `auth` variant; agent and session tools use the operation-defined discriminated union; session updates accept only agent tool/MCP overrides; session-resource attachments use the spec's file/memory-store/repository union; repository resource updates require `authorization_token`; and user-message events use typed content-block arrays. Agent create/update MCP inputs use a separate type because their `type` discriminator is optional while response and session-override MCP entries require it. Environment create/update configs likewise use their request-specific optional discriminators and nullable package/networking values rather than the stricter response shape.
- **File uploads no longer accept a separate `content_type` multipart part.** Set the MIME type on the uploaded `File`/`Uploadable`, matching the core operation's single required `file` part.
- **`AgentSkillDefinition` now follows the final discriminated union.** `type` is `"custom"` or `"anthropic"`, `skill_id` is required, and `version` is `string | null` rather than a number/string catch-all.
- **Deep-import subpaths moved** along with the file moves above (e.g. Trigger imports now live under `@orca-ae/orca-sdk/resources/triggers`, while agent providers remain under `resources/cloud/agents/providers`). The documented root-level `Triggers` export remains available, but Trigger entity and request type names now follow the core contract.

### Added

- A Helm/Kind E2E workflow for the built SDK against direct Managed Agents, including deterministic session
  execution, event polling, SSE replay, core Trigger lifecycle/session history,
  policy/pricing extensions, and rejection of unavailable hosted extensions. The
  proprietary hosted provider topology and its source, image, and OAuth dependencies
  are excluded; the SDK's hosted-extension API surface and mocked tests are unchanged.
- `orca.discovery.groups()` — `GET /apis`, the extension API groups a deployment serves. Powers the `orca.cloud.*` gate; also callable directly.
- `ExtensionNotAvailableError` and `CLOUD_EXTENSION_GROUP` (`"cloud.sn.io"`) exported from the package root.
- `orca.guardrails` for policy-extension create/list/retrieve/update/archive/delete operations and builtin type discovery, plus the exported `POLICY_EXTENSION_GROUP` constant.
- `orca.modelPrices` for read-only pricing-extension list/retrieve operations, plus the exported `PRICING_EXTENSION_GROUP` constant.
- `orca.discovery.policyGroupResources()` and `orca.discovery.pricingGroupResources()` for group-level API-resource discovery.
- `orca.triggers` for core Trigger create/list/retrieve/update/delete plus pause and unpause actions.
- `orca.triggers.sessions.list(triggerId, params?)` for paginated core Sessions created by a Trigger.
- `orca.files.download(fileId)` for raw file content downloads.
- `orca.sessions.files` for listing, retrieving, downloading, and deleting files attached to a session.
- Session creation support for `agent_id`, `agent_with_overrides`, and `initial_events`, plus response types for `outcome_evaluations`, timing, and deployment IDs.
- `orca.memoryStores.memories` for memory CRUD operations.
- `orca.memoryStores.memoryVersions` for listing, retrieving, and redacting memory versions.
- Vendored the final merged core and cloud-extension contracts. Core paths are written host-root-relative in `openapi/managed-agents.yaml`; `openapi/cloud-extensions.yaml` uses `servers[0].url: /apis/cloud.sn.io/v1`. The old combined registry contract is removed; nothing in the SDK reads it.
- Vendored `openapi/managed-agents-deployment.overlay.yaml` alongside the raw core contract so SDK updates can preserve the request and operation surface shared by both supported backends.
- Vendored `openapi/managed-agents-extensions.yaml` separately from the core contract for the `policy.runorca.ai` and `pricing.runorca.ai` API groups.
- Exposed every functional operation in `openapi/cloud-extensions.yaml` under `orca.cloud.*`: API-resource discovery, catalogs, connections, functions, health, packages, sink/source connectors, and Kafka Connect worker/plugin/connector APIs. The Kafka plugin config-validation operation remains absent because its only declared response is an unsupported HTTP 400.

### Changed

- Refreshed the cloud extension contract and added Kafka connection Schema Registry configuration to `orca.cloud.connections` types.
- E2E and integration tests verify that Session archive returns the archived resource.
- Skill and skill-version uploads preserve safe bundle-relative multipart `File` names instead of stripping directory components, while response- and stream-derived names remain basename-normalized.
- `update` methods for agents, sessions, environments, memory stores, and vaults now use `POST`, matching the current OpenAPI spec. Agent updates accept versionless partial bodies; `version` remains available as an optional optimistic-concurrency precondition.
- Environment response configs retain the spec's required `cloud`/`self_hosted` discriminator and complete package/networking blocks, while create/update configs model their independently optional discriminators and nullable values.
- `orca.agents.list(params?)` exposes the shared `include_archived` filter; agent-version lists expose only their supported `limit` and `page` controls.
- Session resource responses now use the core spec's exact file, memory-store, and GitHub-repository union, while detach returns a typed tombstone.
- Session event lists and streams expose their complete core query controls, event appends return persisted acknowledgements on both backends, and session deletion returns `DeletedSession`.
- Agent, session, vault, and environment metadata updates allow `null` for clearable fields or keys; environment create/update use their portable nested `config` shape; credential lists expose `include_archived`; and credential auth updates use their operation-specific discriminated union.
- `PageCursor` now follows opaque `next_page` tokens and both file-list ID-cursor directions: `last_id` advances `after_id` requests, while `first_id` continues `before_id` requests without mixing the mutually exclusive cursors. It also exposes nullable `prev_page` where returned.
- Discovery types use the final snake_case wire fields: `group_version` and `preferred_version`.
- Trigger schemas now reflect the core contract plus its managed-deployment schema extension: nested `agent`/`source`/`session` objects, cron/Kafka/Pulsar sources, all managed session modes, positive replica counts, `agent_id` list filtering, typed tombstones, and core `Session` history items. Backend-specific unsupported combinations are rejected by the backend rather than preflighted by the SDK.
- Agent model configs now expose `effort` and provider-qualified models from the final core contract.
- Agent create/update and responses expose optional `guardrail_ids`, and `agent_with_overrides` session inputs accept session-local `guardrail_ids` for beta-enabled requests. Requests that include these fields are capability-gated on `policy.runorca.ai`, so unsupported deployments fail before the core request is sent.
- Skill lists omit the unsupported `source` filter; memory lists expose `depth`, `path_prefix`, and `view`; memory-version lists expose API-key, operation, creation-time, and view filters while omitting `session_id`.
- File metadata now uses the two stable core response variants; file deletion returns `DeletedFile`, and memory-version redaction returns the redacted `MemoryVersion`.
- Memory-store lists retain their shared archive filter, while memory-version retrieval exposes its optional `view` parameter.
- Stable core response types replace open or widened records for memories, memory stores, memory versions, skills, skill versions, vaults, vault credentials, credential validation, session resources, session threads, and environments.
- Agent and session response types now preserve required fields and nullable values from the core contract. Session and thread agent snapshots are modeled separately from complete agent resources, and object-form session agent references require their `type` discriminator.
- Session and thread event streams retain the `RequestOptions` shorthand while also exposing resume, subpath, and event-delta parameters supported by both backends.
- Refreshed `cloud-extensions.yaml` to remove the deprecated Agent Functions resource group; it was never exposed by this SDK.
- Core deletes for environments, memory stores, memories, session resources, skills and versions, vaults, and credentials return typed tombstones. Archive methods for agents, sessions, environments, memory stores, vaults, and credentials return the updated entity.
- The package ships the verbatim Apache License 2.0 text and a NOTICE file that credits the third-party code the HTTP client runtime is adapted from.

## 0.2.2 (2026-09-28)


### Features

* initialize Orca TypeScript SDK ([#1](https://github.com/orca-ae/orca-sdk-typescript/issues/1)) ([e5adf5d](https://github.com/orca-ae/orca-sdk-typescript/commit/e5adf5d471b34bc7bad82f72b70606b97c9c0112))

## 0.2.0

Breaking realignment with the registry OpenAPI contract. The SDK now exactly mirrors the OpenAPI surface — paths, HTTP verbs, and resource hierarchies.

### Breaking

- **Sessions and their sub-resources are now top-level**, no longer nested under an agent. The `agentId` parameter has been removed from every method on `orca.sessions`, `orca.sessions.events`, `orca.sessions.resources`, `orca.sessions.threads`, and `orca.sessions.threads.events`.
  - Old: `orca.sessions.create(agentId, params)` → New: `orca.sessions.create(params)` (the `agent` field on the body is unchanged).
  - Old: `orca.sessions.list(agentId, params?)` → New: `orca.sessions.list({ agent_id, ...params? })` (filter via query param).
  - Old: `orca.session(agentId, sessionId)` → New: `orca.session(sessionId)`. `SessionHandle.agentId` is removed.
- **Paths no longer include an `/agents/` infix** for non-agent resources. The base path now matches the spec's `servers[0].url = /v1/registry`:
  - `/v1/registry/agents/files` → `/v1/registry/files`
  - `/v1/registry/agents/environments` → `/v1/registry/environments`
  - `/v1/registry/agents/memory_stores` → `/v1/registry/memory_stores`
  - `/v1/registry/agents/skills` → `/v1/registry/skills`
  - `/v1/registry/agents/vaults` → `/v1/registry/vaults`
  - `/v1/registry/agents/{id}/sessions/...` → `/v1/registry/sessions/...`
- **Archive endpoints use the `/archive` sub-path**, not the `:archive` action form (matches spec). Affects `agents`, `sessions`, `sessions.threads`, `memory_stores`, `environments`, `vaults`, and the new `vaults.credentials`.
- **HTTP-method fixes**: `memoryStores.update` is now `PATCH` (was `POST`). `sessions.update` is now `PUT` (was `POST`). `agents.archive` is now `POST /agents/{id}/archive` (was `DELETE /agents/{id}`). The thread events stream is now `/sessions/{sessionId}/threads/{threadId}/stream` (was `.../events/stream`).
- **Removed** `memoryStores.memories` and `memoryStores.memoryVersions` sub-resources. These paths do not exist in the current spec.

### Added

- `orca.vaults.credentials.retrieve(vaultId, credentialId)` — `GET /vaults/{vid}/credentials/{cid}`.
- `orca.vaults.credentials.update(vaultId, credentialId, params)` — `POST /vaults/{vid}/credentials/{cid}`.
- `orca.vaults.credentials.archive(vaultId, credentialId)` — `POST /vaults/{vid}/credentials/{cid}/archive`.
- `orca.vaults.credentials.validate(vaultId, credentialId)` — `POST /vaults/{vid}/credentials/{cid}/mcp_oauth_validate`.

### Documentation

- New `AGENTS.md` and `CLAUDE.md` at the repo root capturing the coding conventions every contributor (human or agent) must follow.
- `docs/surface-status.md` rewritten: reflects the realigned signatures, documents the new credentials operations, and lists the resource groups in the spec that are intentionally not exposed today (`agentfunctions`, `functions`, `connections`, `connectors/{sinks,sources,kafka}`, `catalog`, `packages`, `health`).

## 0.1.1-rc1

Pre-release version cut for GitHub Packages release-please plumbing. No surface changes.

## 0.1.0

Initial release.
