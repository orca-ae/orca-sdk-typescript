# Surface status

This document tracks which Orca API surfaces have SDK coverage in `@runorca/orca-sdk` and what is intentionally absent today. It is updated whenever an operation lands or is removed.

Three specs plus a deployment overlay govern the surface (see `AGENTS.md` §1): `openapi/managed-agents.yaml` defines core operations, `openapi/managed-agents-deployment.overlay.yaml` records core portability differences, `openapi/managed-agents-extensions.yaml` defines the engine-owned policy and pricing extension groups, and `openapi/cloud-extensions.yaml` governs `orca.cloud.*`.

The package-root `VERSION` export and the client's User-Agent report the version in `package.json`, including any release-candidate suffix. CommonJS and ESM builds expose the same version.

## Implemented

### Agents — `orca.agents`

Agent responses expose the complete required core shape, including present-but-nullable description, system, multi-agent configuration, and archive timestamp fields. Tool inputs use the core discriminated union, agent create/update MCP entries may omit their optional `type: "url"` discriminator, and beta-enabled requests may attach policy resources through optional `guardrail_ids`. Requests that include this extension field first require the deployment to advertise `policy.runorca.ai`; ordinary Agent requests do not incur discovery.

| Method | Description |
|---|---|
| `orca.agents.create(params)` | Create a new agent |
| `orca.agents.retrieve(agentId, params?)` | Retrieve an agent by ID; optional `version` param for historical lookup |
| `orca.agents.update(agentId, params)` | Partially update an agent (POST per the spec); optionally pass `version` for optimistic concurrency |
| `orca.agents.list(params?)` | Paginated list of agents, optionally filtered by archive state |
| `orca.agents.archive(agentId)` | Archive and return an agent — `POST /agents/{agentId}/archive` |

### Agent versions — `orca.agents.versions`

| Method | Description |
|---|---|
| `orca.agents.versions.list(agentId, params?)` | List historical versions of an agent with page-token pagination |

### Sessions — `orca.sessions`

Sessions are top-level. Create accepts either a string agent shorthand, a discriminated `agent`/`agent_with_overrides` object, or the shared `agent_id` compatibility form, plus optional `initial_events`; an `agent_with_overrides` request may set session-local `guardrail_ids` when `policy.runorca.ai` is advertised. `list()` accepts the shared `agent_id`, pagination, and archive filters. Response collections such as `outcome_evaluations` and `resources` follow the core contract as required arrays.

| Method | Description |
|---|---|
| `orca.sessions.create(params)` | Create a new session |
| `orca.sessions.retrieve(sessionId)` | Retrieve a session |
| `orca.sessions.update(sessionId, params)` | Update session metadata (POST per the spec) |
| `orca.sessions.list(params?)` | Paginated list of sessions, optionally filtered by `agent_id` |
| `orca.sessions.delete(sessionId)` | Delete a session and return its tombstone |
| `orca.sessions.archive(sessionId)` | Archive and return a session |

### Session events — `orca.sessions.events`

| Method | Description |
|---|---|
| `orca.sessions.events.list(sessionId, params?)` | List persisted events with time, type, subpath, pagination, and ordering filters |
| `orca.sessions.events.send(sessionId, params)` | Append events and return their persisted representations |
| `orca.sessions.events.stream(sessionId, params?, options?)` | Open or resume an SSE stream with optional subpath and event-delta controls |

### Session files — `orca.sessions.files`

These are core server operations implemented by both supported backends. They use ID cursors (`after_id`/`before_id`) rather than opaque `page` tokens; automatic iteration preserves the requested direction by following `last_id` for `after_id` and `first_id` for `before_id`. They retain the session in every item path so the server validates file ownership.

| Method | Description |
|---|---|
| `orca.sessions.files.list(sessionId, params?)` | Paginated list of files attached to a session — `GET /v1/sessions/{sessionId}/files` |
| `orca.sessions.files.retrieve(sessionId, fileId)` | Retrieve session file metadata — `GET /v1/sessions/{sessionId}/files/{fileId}` |
| `orca.sessions.files.download(sessionId, fileId)` | Download raw session file content — `GET /v1/sessions/{sessionId}/files/{fileId}/content` |
| `orca.sessions.files.delete(sessionId, fileId)` | Delete a session file and return its tombstone — `DELETE /v1/sessions/{sessionId}/files/{fileId}` |

### Session resources — `orca.sessions.resources`

| Method | Description |
|---|---|
| `orca.sessions.resources.list(sessionId, params?)` | List resources attached to a session |
| `orca.sessions.resources.add(sessionId, params)` | Attach a typed file, memory-store, or repository resource |
| `orca.sessions.resources.retrieve(sessionId, resourceId)` | Retrieve a session resource |
| `orca.sessions.resources.update(sessionId, resourceId, params)` | Rotate a repository resource's authorization token (POST per the spec) |
| `orca.sessions.resources.delete(sessionId, resourceId)` | Remove a resource and return its tombstone |

### Session threads — `orca.sessions.threads`

A session has one primary thread plus zero or more child threads spawned by the coordinator. Threads are not created by the SDK; the coordinator produces them as the session runs. Thread responses preserve their required discriminator, status, nullable parent, usage/statistics, and archive timestamp fields.

| Method | Description |
|---|---|
| `orca.sessions.threads.list(sessionId, params?)` | Paginated list of threads in a session |
| `orca.sessions.threads.retrieve(sessionId, threadId)` | Retrieve a thread |
| `orca.sessions.threads.archive(sessionId, threadId)` | Archive a thread |

#### Thread events — `orca.sessions.threads.events`

| Method | Description |
|---|---|
| `orca.sessions.threads.events.list(sessionId, threadId, params?)` | Paginated list of events for a specific thread |
| `orca.sessions.threads.events.stream(sessionId, threadId, params?, options?)` | Open or resume an SSE stream for a specific thread with optional event-delta controls |

### Environments — `orca.environments`

Environment responses use the required `cloud`/`self_hosted` config discriminator. Create and update use their distinct portable request config shape, where config and package discriminators are optional and package/networking values may be `null`. The non-portable flat `packages`, `networking`, `image`, and `target` request fields are intentionally omitted; use `config` for portable package, networking, and target selection. Update metadata values may be `null` to remove individual keys.

| Method | Description |
|---|---|
| `orca.environments.create(params)` | Create an environment |
| `orca.environments.retrieve(environmentId)` | Retrieve an environment |
| `orca.environments.update(environmentId, params)` | Update an environment (POST per the spec) |
| `orca.environments.list(params?)` | Paginated list of environments |
| `orca.environments.delete(environmentId)` | Delete an environment and return its tombstone |
| `orca.environments.archive(environmentId)` | Archive and return an environment |

### Files — `orca.files`

Multipart upload accepts only the required `file` part. Set its MIME type on the uploaded `File` or other `Uploadable`; responses use the core file metadata union.

| Method | Description |
|---|---|
| `orca.files.upload(params)` | Upload a file via `multipart/form-data` |
| `orca.files.retrieve(fileId)` | Retrieve file metadata |
| `orca.files.download(fileId)` | Download raw file content |
| `orca.files.list(params?)` | Paginated list of uploaded files |
| `orca.files.delete(fileId)` | Delete a file and return its tombstone |

### Skills — `orca.skills`

Skills are uploaded as multipart with a required `files` array. Create and version uploads preserve safe bundle-relative `File` names such as `my-skill/SKILL.md`, while names inferred from response URLs or stream paths remain basename-normalized. Lists expose the pagination controls shared by both backends.

| Method | Description |
|---|---|
| `orca.skills.create(params)` | Create a skill (multipart) |
| `orca.skills.retrieve(skillId)` | Retrieve a skill |
| `orca.skills.list(params?)` | Paginated list of skills |
| `orca.skills.delete(skillId)` | Delete a skill and return its tombstone |

#### Skill versions — `orca.skills.versions`

| Method | Description |
|---|---|
| `orca.skills.versions.create(skillId, params)` | Create a new skill version (multipart) |
| `orca.skills.versions.retrieve(skillId, versionId)` | Retrieve a specific version |
| `orca.skills.versions.list(skillId, params?)` | Paginated list of versions |
| `orca.skills.versions.delete(skillId, versionId)` | Delete a version and return its tombstone |

### Vaults — `orca.vaults`

Vault responses expose the required display name and metadata fields, plus the present-but-nullable archive timestamp.

| Method | Description |
|---|---|
| `orca.vaults.create(params)` | Create a vault |
| `orca.vaults.retrieve(vaultId)` | Retrieve a vault |
| `orca.vaults.update(vaultId, params)` | Update a vault (POST per the spec) |
| `orca.vaults.list(params?)` | Paginated list of vaults |
| `orca.vaults.delete(vaultId)` | Delete a vault and return its tombstone |
| `orca.vaults.archive(vaultId)` | Archive and return a vault |

#### Vault credentials — `orca.vaults.credentials`

| Method | Description |
|---|---|
| `orca.vaults.credentials.list(vaultId, params?)` | Paginated list of credentials, optionally including archived credentials |
| `orca.vaults.credentials.create(vaultId, params)` | Create a credential |
| `orca.vaults.credentials.retrieve(vaultId, credentialId)` | Retrieve a credential |
| `orca.vaults.credentials.update(vaultId, credentialId, params)` | Update a credential (POST per the spec) |
| `orca.vaults.credentials.delete(vaultId, credentialId)` | Delete a credential and return its tombstone |
| `orca.vaults.credentials.archive(vaultId, credentialId)` | Archive and return a credential |
| `orca.vaults.credentials.validate(vaultId, credentialId)` | Validate the credential's MCP OAuth configuration and return the typed result |

### Memory stores — `orca.memoryStores`

Memory-store responses preserve the core `type: "memory_store"` discriminator.

| Method | Description |
|---|---|
| `orca.memoryStores.create(params)` | Create a new memory store |
| `orca.memoryStores.retrieve(memoryStoreId)` | Retrieve a memory store |
| `orca.memoryStores.update(memoryStoreId, params)` | Update a memory store (POST per the spec) |
| `orca.memoryStores.list(params?)` | Paginated list with an archive-state filter |
| `orca.memoryStores.delete(memoryStoreId)` | Delete a memory store and return its tombstone |
| `orca.memoryStores.archive(memoryStoreId)` | Archive a memory store |

#### Memories — `orca.memoryStores.memories`

| Method | Description |
|---|---|
| `orca.memoryStores.memories.list(memoryStoreId, params?)` | Paginated list of memories with depth, path-prefix, and view controls |
| `orca.memoryStores.memories.create(memoryStoreId, params)` | Create a memory with required `path` and `content` |
| `orca.memoryStores.memories.retrieve(memoryStoreId, memoryId, params?)` | Retrieve a memory |
| `orca.memoryStores.memories.update(memoryStoreId, memoryId, params)` | Update a memory (POST per the spec) |
| `orca.memoryStores.memories.delete(memoryStoreId, memoryId, params?)` | Delete a memory and return its tombstone |

#### Memory versions — `orca.memoryStores.memoryVersions`

| Method | Description |
|---|---|
| `orca.memoryStores.memoryVersions.list(memoryStoreId, params?)` | Paginated audit trail with memory, API-key, operation, creation-time, and view filters; `session_id` is not portable |
| `orca.memoryStores.memoryVersions.retrieve(memoryStoreId, memoryVersionId, params?, options?)` | Retrieve a memory version with an optional view |
| `orca.memoryStores.memoryVersions.redact(memoryStoreId, memoryVersionId)` | Redact and return a memory version |

### Discovery — `orca.discovery`

| Method | Description |
|---|---|
| `orca.discovery.groups(options?)` | List the extension API groups this deployment serves — authenticated `GET /apis`. An empty `groups` array means "no extensions installed," not an error. Version fields use the wire names `group_version` and `preferred_version`. |
| `orca.discovery.policyGroupResources(options?)` | List resources advertised by `policy.runorca.ai/v1`; gated by discovery |
| `orca.discovery.pricingGroupResources(options?)` | List resources advertised by `pricing.runorca.ai/v1`; gated by discovery |

### Triggers — `orca.triggers`

Triggers are core `/v1/triggers` operations shared by both supported backends. The managed-deployment overlay widens the request/response schemas with Kafka and Pulsar sources, `SESSION_PER_EVENT`, `SESSION_PER_TOPIC`, `SESSION_PER_KEY`, and `SHARED` modes, and positive replica counts. The SDK preserves those capabilities without client-side backend gating; deployments that implement only the narrower cron subset return their normal API error for unsupported combinations.

| Method | Description |
|---|---|
| `orca.triggers.create(params)` | Create a Trigger |
| `orca.triggers.list(params?)` | Paginated Trigger list, optionally filtered by `agent_id` |
| `orca.triggers.retrieve(triggerId)` | Retrieve a Trigger |
| `orca.triggers.update(triggerId, params)` | Partially update a Trigger (POST per the spec) |
| `orca.triggers.delete(triggerId)` | Permanently delete a Trigger and return `DeletedTrigger` |
| `orca.triggers.pause(triggerId)` | Pause and return a Trigger |
| `orca.triggers.unpause(triggerId)` | Resume and return a Trigger |
| `orca.triggers.sessions.list(triggerId, params?)` | Paginated list of core `Session` entities created by a Trigger |

### Guardrails — `orca.guardrails`

Operations under `/apis/policy.runorca.ai/v1` are capability-gated through `GET /apis`. Calls throw `ExtensionNotAvailableError` before the guardrail request when the deployment does not advertise `policy.runorca.ai`.

Direct Managed Agents E2E exercises policy discovery,
Guardrail type discovery and lifecycle, and Agent/Session Guardrail attachment.

| Method | Description |
|---|---|
| `orca.guardrails.create(params)` | Create a builtin or expression guardrail |
| `orca.guardrails.list(params?)` | Paginated list, optionally including archived guardrails |
| `orca.guardrails.retrieve(guardrailId)` | Retrieve a guardrail |
| `orca.guardrails.update(guardrailId, params)` | Partially update a guardrail (POST per the spec) |
| `orca.guardrails.archive(guardrailId)` | Archive and return a guardrail |
| `orca.guardrails.delete(guardrailId)` | Permanently delete an unreferenced guardrail and return its tombstone |
| `orca.guardrails.listTypes()` | List builtin guardrail types and parameter schemas |

### Model prices — `orca.modelPrices`

The pricing group is read-only in the public SDK and is also capability-gated through `GET /apis`.

Both E2E topologies require pricing discovery, a nonempty seeded price catalog,
and retrieval by model ID and provider.

| Method | Description |
|---|---|
| `orca.modelPrices.list(params?)` | Paginated list of effective model prices |
| `orca.modelPrices.retrieve(modelId, params?)` | Retrieve a model price, optionally selecting a provider |

### Hosted extensions — `orca.cloud.*`

Operations served under `/apis/cloud.sn.io/v1/*`, the hosted extension group — not the core engine. Every method below throws `ExtensionNotAvailableError` when called against a deployment that doesn't advertise the `cloud.sn.io` extension group via `GET /apis`. Discovery uses the cloud call's per-request deployment and controls, caches successful results per effective deployment URL, and isolates concurrent probes that carry explicit request controls (see `AGENTS.md` §5 and §10).

#### Cloud agent providers — `orca.cloud.agents.providers`

Moved out from under core `orca.agents`: `GET /v1/registry/agents/providers` and `GET /v1/registry/agents/{agent_id}` shared a route shape. Under the `/apis/cloud.sn.io/v1` group prefix that ambiguity doesn't exist.

| Method | Description |
|---|---|
| `orca.cloud.agents.providers.list(options?)` | List registered agent providers |
| `orca.cloud.agents.providers.retrieve(providerName, options?)` | Retrieve a specific provider by name |

#### Cloud API resources — `orca.cloud.apiResources`

| Method | Description |
|---|---|
| `orca.cloud.apiResources.list(options?)` | Discover the resources advertised by the `cloud.sn.io/v1` API group |

#### Connector catalog — `orca.cloud.catalog`

| Method | Description |
|---|---|
| `orca.cloud.catalog.kafka.list(options?)` | List Kafka connector definitions |
| `orca.cloud.catalog.kafka.retrieve(name, options?)` | Retrieve Kafka connector configuration fields |
| `orca.cloud.catalog.sinks.list(options?)` | List sink connector definitions |
| `orca.cloud.catalog.sinks.retrieve(name, options?)` | Retrieve sink connector configuration fields |
| `orca.cloud.catalog.sources.list(options?)` | List source connector definitions |
| `orca.cloud.catalog.sources.retrieve(name, options?)` | Retrieve source connector configuration fields |

#### Connections — `orca.cloud.connections`

Kafka connection definitions support an optional `spec.kafka.schemaRegistry` with a URL and optional basic or OAuth2 authentication configuration.

| Method | Description |
|---|---|
| `orca.cloud.connections.list(options?)` | List external connection definitions |
| `orca.cloud.connections.create(params, options?)` | Create a connection |
| `orca.cloud.connections.retrieve(name, options?)` | Retrieve a connection |
| `orca.cloud.connections.update(name, params, options?)` | Replace a connection |
| `orca.cloud.connections.delete(name, options?)` | Delete a connection |
| `orca.cloud.connections.test(name, options?)` | Test a stored connection |
| `orca.cloud.connections.validate(params, options?)` | Validate a connection configuration |

#### Functions — `orca.cloud.functions`

Function create/update/state/trigger requests use the multipart shapes declared by the contract. File and stream parts accept `Uploadable`.

| Method | Description |
|---|---|
| `orca.cloud.functions.list(options?)` | List function names |
| `orca.cloud.functions.create(name, params, options?)` | Register a function |
| `orca.cloud.functions.retrieve(name, options?)` | Retrieve a function configuration |
| `orca.cloud.functions.update(name, params, options?)` | Update a function |
| `orca.cloud.functions.delete(name, options?)` | Deregister a function |
| `orca.cloud.functions.retrieveStats(name, options?)` | Retrieve aggregate statistics |
| `orca.cloud.functions.retrieveInstanceStats(name, instanceId, options?)` | Retrieve instance statistics |
| `orca.cloud.functions.retrieveStatus(name, options?)` | Retrieve aggregate status |
| `orca.cloud.functions.retrieveInstanceStatus(name, instanceId, options?)` | Retrieve instance status |
| `orca.cloud.functions.retrieveState(name, key, options?)` | Retrieve state by key |
| `orca.cloud.functions.updateState(name, key, params, options?)` | Write state by key |
| `orca.cloud.functions.restart(name, options?)` | Restart every instance |
| `orca.cloud.functions.restartInstance(name, instanceId, options?)` | Restart one instance |
| `orca.cloud.functions.start(name, options?)` | Start every instance |
| `orca.cloud.functions.startInstance(name, instanceId, options?)` | Start one instance |
| `orca.cloud.functions.stop(name, options?)` | Stop every instance |
| `orca.cloud.functions.stopInstance(name, instanceId, options?)` | Stop one instance |
| `orca.cloud.functions.trigger(name, params, options?)` | Trigger a function |

#### Health — `orca.cloud.health`

| Method | Description |
|---|---|
| `orca.cloud.health.check(options?)` | Check service health |
| `orca.cloud.health.ready(options?)` | Check readiness |
| `orca.cloud.health.live(options?)` | Check liveness |

#### Packages — `orca.cloud.packages`

The vendored contract does not declare response schemas for `list`, `listVersions`, or
`retrieveMetadata`, so those methods return `unknown` until the contract defines their shapes.

| Method | Description |
|---|---|
| `orca.cloud.packages.list(type, options?)` | Return the package listing for a package type |
| `orca.cloud.packages.listVersions(type, name, options?)` | Return the available-version listing for a package |
| `orca.cloud.packages.download(type, name, version, options?)` | Download raw package content |
| `orca.cloud.packages.upload(type, name, version, params, options?)` | Upload package content and metadata |
| `orca.cloud.packages.delete(type, name, version, options?)` | Delete a package version |
| `orca.cloud.packages.retrieveMetadata(type, name, version, options?)` | Return the package metadata response |
| `orca.cloud.packages.updateMetadata(type, name, version, params, options?)` | Replace package metadata |

#### Sink connectors — `orca.cloud.connectors.sinks`

| Method | Description |
|---|---|
| `list(options?)` | List sink names |
| `create(name, params, options?)` | Register a sink |
| `retrieve(name, options?)` | Retrieve sink configuration |
| `update(name, params, options?)` | Update a sink |
| `delete(name, options?)` | Deregister a sink |
| `retrieveStatus(name, options?)` | Retrieve aggregate status |
| `retrieveInstanceStatus(name, instanceId, options?)` | Retrieve instance status |
| `restart(name, options?)` / `restartInstance(name, instanceId, options?)` | Restart all instances or one instance |
| `start(name, options?)` / `startInstance(name, instanceId, options?)` | Start all instances or one instance |
| `stop(name, options?)` / `stopInstance(name, instanceId, options?)` | Stop all instances or one instance |

#### Source connectors — `orca.cloud.connectors.sources`

The source surface mirrors sink lifecycle naming: `list`, `create`, `retrieve`, `update`, `delete`, `retrieveStatus`, `retrieveInstanceStatus`, and all/instance `restart`, `start`, and `stop` methods.

#### Kafka Connect — `orca.cloud.connectors.kafka`

| Method | Description |
|---|---|
| `health(options?)` | Check worker health |
| `serverInfo(options?)` | Retrieve worker information |
| `plugins.list(params?, options?)` | List installed connector plugins |
| `plugins.retrieveConfig(pluginName, options?)` | Retrieve plugin configuration fields |
| `plugins.listCatalog(options?)` | List the connector plugin catalog |
| `connectors.list(options?)` | List active connectors |
| `connectors.create(params, options?)` | Create a connector |
| `connectors.retrieve(name, options?)` | Retrieve a connector |
| `connectors.delete(name, options?)` | Delete a connector |
| `connectors.retrieveConfig(name, options?)` | Retrieve connector configuration |
| `connectors.updateConfig(name, params, options?)` | Replace connector configuration |
| `connectors.retrieveStatus(name, options?)` | Retrieve connector status |
| `connectors.retrieveOffsets(name, options?)` | Retrieve connector offsets |
| `connectors.resetOffsets(name, options?)` | Reset connector offsets |
| `connectors.updateOffsets(name, params, options?)` | Alter connector offsets |
| `connectors.retrieveActiveTopics(name, options?)` | Retrieve active topics |
| `connectors.resetActiveTopics(name, options?)` | Reset active topics |
| `connectors.listTasks(name, options?)` | List task configurations |
| `connectors.retrieveTaskStatus(name, task, options?)` | Retrieve task status |
| `connectors.retrieveTasksConfig(name, options?)` | Retrieve the worker task-config object |
| `connectors.pause(name, options?)` | Pause a connector |
| `connectors.restart(name, params?, options?)` | Restart a connector, optionally including tasks or only failures |
| `connectors.restartTask(name, task, options?)` | Restart one task |
| `connectors.resume(name, options?)` | Resume a connector |
| `connectors.stop(name, options?)` | Stop a connector |

### Session handle — `orca.session(sessionId)`

Returns an ergonomic `SessionHandle` with `.events`, `.resources`, `.files`, and `.threads` sub-objects that pre-fill `sessionId` on every call. Reduces repetition when working with a single session.

## Deliberately unsupported

`validateConfigs` (`PUT /connectors/kafka/connector-plugins/{pluginName}/config/validate`) is not exposed because the spec declares no successful response; its only response is HTTP 400 stating that validation is unsupported. `tests/cloud-extensions-contract.test.ts` keeps this exception explicit while requiring every other operationId to remain mapped to a callable SDK method.
