# Orca TypeScript SDK: instructions for coding agents

This file is for AI coding agents such as Claude Code, Codex, Copilot and Cursor, and it doubles as the conventions guide for anyone adding code to `@orca-ae/orca-sdk`. People should start with [CONTRIBUTING.md](CONTRIBUTING.md).

`CLAUDE.md` is a symlink to this file. **Always edit `AGENTS.md`, never `CLAUDE.md`.** A write that replaces the file would turn the symlink into a copy.

## Rules that come first

These rules implement the project's [AI policy](AI_POLICY.md) and override anything else in this file.

- **Never add a `Signed-off-by:` line, even if asked.** Only the human can certify the Developer Certificate of Origin. When a commit is ready, tell them to review it and run `git commit --amend -s --no-edit`, or `git rebase --signoff origin/main` for several commits.
- **End each commit message with exactly one AI trailer: `Assisted-by: <tool>`.** This repository configures Claude Code to use `Assisted-by: Claude Code` (see `.claude/settings.json`). If your tool adds its own `Co-authored-by:` trailer, that counts; don't add both.
- **Don't act outside the local checkout without explicit approval for that specific action.** That covers pushing, opening or editing a pull request or issue, and commenting on GitHub. Being asked to start a task isn't permission to publish it. When a maintainer asks you through an `@claude` mention on GitHub, that request approves your reply, and the commits it asks for, in that run.
- **Leave force-pushes to the human.** If a push needs `--force`, for example after the commits were re-signed, hand it over.
- **Draft pull request descriptions from [the template](.github/pull_request_template.md)**, including the *AI assistance* section. Give the draft to the human to edit and post.
- **Report what you verified and what you didn't.** Never say a test or check passed unless you ran it and saw it pass.

## Boundaries

**Always**

- Run `yarn lint` and `yarn test` before you say a change is done, and `yarn build` as well before you draft a pull request.
- Keep the public surface mapped 1:1 to the vendored specs (§1).
- Follow the existing patterns of the resource you're changing.

**Ask first**

- Adding or upgrading a dependency.
- A breaking change to the public TypeScript API. It also needs an OIP ([proposals/](proposals/README.md)).
- Changing anything under `.github/workflows`.
- Deleting, disabling or loosening a test.

**Never**

- Edit `LICENSE` or `NOTICE`, or change the text of license headers.
- Hand-edit a vendored spec under `openapi/`. Refresh it from its upstream artifact instead.
- Force-push, rewrite published history, or commit secrets.
- Claim performance or compatibility results in code or docs unless a test in this repository backs them.

## 1. Source of truth

Three vendored OpenAPI specs and the core deployment overlay define the SDK surface:

| Artifact | Base-path rule | Governs |
|---|---|---|
| `openapi/managed-agents.yaml` | No `servers` entry; paths carry `/v1`, `/api`, or `/apis` explicitly. | Core resources: `orca.agents` (+`.versions`), `orca.sessions` (+`.events`, `.files`, `.resources`, `.threads(.events)`), `orca.environments`, `orca.files`, `orca.skills` (+`.versions`), `orca.vaults` (+`.credentials`), `orca.memoryStores` (+`.memories`, `.memoryVersions`), `orca.triggers` (+`.sessions`), `orca.discovery`. |
| `openapi/managed-agents-deployment.overlay.yaml` | Applies to `managed-agents.yaml`; it has no independent server URL. | Deployment deviations from the core contract. Its removal actions define fields, parameters, and operations that are not portable across both supported backends. |
| `openapi/managed-agents-extensions.yaml` | Paths carry `/apis/policy.runorca.ai/v1` or `/apis/pricing.runorca.ai/v1` explicitly. | Engine extensions: `orca.guardrails`, `orca.modelPrices`, and their API-resource discovery methods. |
| `openapi/cloud-extensions.yaml` | `/apis/cloud.sn.io/v1` | The complete `orca.cloud.*` namespace: API-resource discovery, agent providers, catalogs, connections, functions, health, packages, sink/source connectors, and Kafka Connect. |

For core APIs, start from `managed-agents.yaml` and then apply the portability rules encoded by `managed-agents-deployment.overlay.yaml`:

- `remove: true` operations are not exposed.
- `remove_properties` fields are omitted from SDK request types.
- removed query parameters are omitted from SDK parameter types and overloads.
- operations whose responses are replaced with an unsupported response are not exposed as public methods. For example, do not add `orca.agents.delete()` while the overlay marks Agent deletion unsupported.
- `x-deployment-query-parameter-extensions` are deployment-only extensions, not part of the portable core surface. Do not add them to common SDK request types; this includes the top-level `provider` filters.
- `x-deployment-trigger-schema-extension` deliberately widens the core Trigger schemas for the managed deployment. Preserve its Kafka/Pulsar sources, session modes, source fields, and replica range in the public Trigger types. The SDK does not preflight backend-specific Trigger capabilities; a backend that implements only the narrower core subset returns the API error for an unsupported combination.
- binding-ID schema overrides do not require narrower SDK types because public IDs remain opaque strings.

The policy group also contributes optional `guardrail_ids` fields to Agent create/update and `agent_with_overrides` Session create bodies on the engine's core `/v1` routes. Those fields are not portable to deployments without `policy.runorca.ai`: only requests that explicitly include them pass through `extensionGate()` before the core request is sent. Core requests that omit them do not incur extension discovery.

Vendored specs, the overlay included, are kept byte-for-byte identical to their upstream artifacts, titles included; never edit them locally. The overlay's `x-deployment-deviations-source` value records upstream provenance and is not expected to resolve inside this repository. Whenever either backend's core contract changes, refresh and review both `managed-agents.yaml` and the overlay before changing SDK code. Add or update compile-time coverage in `tests/managed-agents-deployment-overlay.test.ts` for every affected public request field or parameter.

Every public method in this SDK maps 1:1 to an `operationId` in whichever spec governs it. We do not invent operations, rename endpoints, or smuggle in extra fields (see §6's note on `beta_version` for a concrete example of a field this SDK stopped sending because no spec ever defined it as a request field). When a spec changes, the SDK changes — not the other way around.

**The OpenAPI documents deliberately encode their bases differently.** Core and engine-extension operation paths already include `/v1`, `/api`, or `/apis` as applicable, while cloud-extension operation paths are relative to `/apis/cloud.sn.io/v1`. Resource methods still write the complete runtime path literally; do not prepend the cloud server to core or double-prepend it to cloud calls. See §5.

`orca.sessions.files` maps to the core `sessions.listFiles`, `sessions.getFile`, `sessions.getFileContent`, and `sessions.deleteFile` operations. Both supported backends serve the canonical `/v1/sessions/{id}/files...` paths; do not reimplement this resource over `/v1/files?scope_id=...`, because the cloud deployment does not expose that filter.

The core spec currently renders most schemas inline. Reuse an existing exported public type when an inline shape is identical rather than inventing a parallel one.

Branding rule: this SDK does not reference any upstream vendor (codename, company, or third-party SDK) in code, comments, docs, examples, commit messages, or tests. When you need to talk about lineage in code, say "this SDK" or refer to a specific local file. The exceptions are deliberate:

- Attribution files (`NOTICE`, `LICENSE`) name the projects that code was adapted from. Attribution always wins over this rule.
- Vendored specs stay byte-identical to their upstream artifacts.
- Wire values the API defines, such as enum values, header names and model identifiers, are spelled the way the API spells them.
- AI tooling files (`CLAUDE.md`, `.claude/`, the Claude workflows) and `Assisted-by:` trailers name the tool they concern.

## 2. Project layout

```
openapi/
  managed-agents.yaml                       # Core contract
  managed-agents-deployment.overlay.yaml    # Core deployment deviations
  managed-agents-extensions.yaml            # Engine policy and pricing extensions
  cloud-extensions.yaml                     # orca.cloud.* contract

src/
  client.ts            # Orca + BaseOrca classes (the request pipeline + resource mounts)
  index.ts             # Public re-exports
  version.ts           # Generated from package.json by scripts/utils/sync-version.cjs
  core/                # Public-facing primitives: APIPromise, PageCursor, Stream, Errors, APIResource
  internal/            # Implementation helpers: headers, request-options, fetch shims, path tagged-template, uploads
  lib/                 # Higher-level conveniences built on top of resources (e.g. SessionHandle)
  resources/           # One file per flat resource, one folder per resource with sub-resources
    files.ts
    environments.ts
    discovery.ts        # GET /apis — orca.discovery
    extension-gate.ts   # Shared capability gate for extension API groups
    agents/{agents,versions,index}.ts
    guardrails/{guardrails,index}.ts
    model-prices/{model-prices,index}.ts
    sessions/{sessions,events,files,resources,threads/{threads,events,index},index}.ts
    memory-stores/{memory-stores,index}.ts
    skills/{skills,versions,index}.ts
    triggers/{triggers,sessions,index}.ts #   orca.triggers(.sessions)
    vaults/{vaults,credentials,index}.ts
    cloud/{cloud,gate,api-resources,connections,functions,health,packages,runtime-types,index}.ts
      agents/{agents,providers,index}.ts    #   orca.cloud.agents.providers
      catalog/{catalog,kafka,sinks,sources,index}.ts
      connectors/{connectors,sinks,sources,index}.ts
        kafka/{kafka,plugins,connectors,index}.ts

tests/
  api-resources/  # Mocked unit tests, mirrors src/resources/ tree
  integration/    # Live-API tests; gated by ORCA_TEST_BASE_URL + ORCA_TEST_API_KEY presence
  e2e/            # kind/Helm end-to-end suite and harness scripts (secret-gated workflows)
  scripts/        # Tests for scripts/utils and the .github YAML
  core/, internal/, lib/  # Tests for the corresponding src/ folders

examples/    # Runnable TypeScript samples, one per `yarn examples:<name>` script
docs/        # surface-status.md and friends
scripts/     # build/lint/test/format entry points used by package.json
```

File-naming rule: kebab-case for both files and folders (`memory-stores/memory-stores.ts`, not `memoryStores.ts`). The resource class inside still uses PascalCase (`MemoryStores`).

## 3. Resource class pattern

Pick the template that matches your case:

- Flat resource (no sub-resources) → look at `src/resources/files.ts`.
- Resource with sub-resources → look at `src/resources/agents/agents.ts`.

Required pieces:

1. `class XYZ extends APIResource { ... }` — import `APIResource` from `../core/resource` (or `../../core/resource` when nested one folder deeper).
2. Methods call `this._client.{get,post,patch,put,delete}(path, options)` or `this._client.getAPIList(path, PageCursor<T>, { query, ...options })` for paginated lists.
3. Path literals always use the `path` tagged template from `../internal/utils/path` whenever there is an interpolated segment. Never concatenate strings or use ordinary template literals — the tagged template escapes path components.
4. Every public method ends with an optional `options?: RequestOptions` parameter so callers can pass per-call headers, signals, idempotency keys, etc.
5. Return types: `APIPromise<T>` for single responses, `PagePromise<PageCursor<T>, T>` for lists, `Promise<Stream<E>>` for SSE.
6. Sub-resources are properties on the parent resource class, instantiated inline at the property declaration so they share the same `_client`:

   ```ts
   export class Vaults extends APIResource {
     credentials: CredentialsAPI.Credentials = new CredentialsAPI.Credentials(this._client);
     // ...
   }
   ```

## 4. HTTP-method mapping

Match the spec verb. Period.

| Use | Verb |
|---|---|
| Retrieve, list | `GET` |
| Create, action endpoints (archive, validate, send, restart) | `POST` |
| Full replacement / optimistic-concurrency update with a `version` field | `PUT` |
| Partial update | `PATCH` |
| Permanent delete | `DELETE` |

If the spec verb feels wrong, push back upstream. Do not silently "correct" it in the SDK — it'll just produce drift.

## 5. Path style

`baseURL` is the **host root**. Every path literal in `src/resources/` carries its own full prefix — nothing about it is implicit in the client.

- **Core resources** (governed by `managed-agents.yaml`) start with `/v1/...` — e.g. `/v1/agents`, `/v1/vaults/{id}/credentials/{id}`. There is no `/registry` infix any more.
- **Engine extension resources** start with `/apis/policy.runorca.ai/v1/...` or `/apis/pricing.runorca.ai/v1/...` and route their options through `extensionGate()` with the matching exported group constant.
- **`orca.cloud.*` resources** (governed by `cloud-extensions.yaml`) start with `/apis/cloud.sn.io/v1/...` — e.g. `/apis/cloud.sn.io/v1/connections`. The literal `cloud.sn.io` appears in each of these path strings by design, matching the "always write the literal path" rule below; the *gating* decision (whether to allow the call at all) references the single `CLOUD_EXTENSION_GROUP` constant in `src/internal/constants.ts` instead of re-deriving the group name from the path.
- Archive endpoints are `POST /.../{id}/archive` — a sub-path, never the colon-action form `:archive`.
- A handful of cloud function and connector action endpoints in the spec do use a colon. Mirror the spec literally: if it writes `/foo:restart`, the SDK uses `/foo:restart`.
- JSON fields stay snake_case in TypeScript (`created_at`, `agent_id`). We mirror the wire shape — no camelCase wrappers.

Use `path` for interpolation:

```ts
this._client.get(path`/v1/vaults/${vaultId}/credentials/${credentialId}`)
this._client.get(path`/apis/cloud.sn.io/v1/connections/${connectionName}`)
```

Every `orca.cloud.*` method routes its `RequestOptions` through `cloudGate()` (`src/resources/cloud/gate.ts`) instead of calling `this._client.get/post/put/delete/getAPIList` directly — see `src/resources/cloud/connections.ts` for the pattern. `cloudGate` defers the options through `ensureExtensionAvailable(CLOUD_EXTENSION_GROUP)`, throwing `ExtensionNotAvailableError` when the deployment doesn't advertise it. This adds no new request-pipeline plumbing: `get`/`post`/`put`/`delete`/`getAPIList` already accept a *promise* of `RequestOptions`, not just a value.

`baseURL` handling in `src/client.ts` strips a trailing `/v1/registry`, `/v1`, or `/api/v1` and logs a deprecation warning — see the constructor. The `/api/v1` case strips the *whole* suffix, not just the trailing `/v1`: leaving `/api` would still resolve core paths (via the `/api/v1/*` alias) but silently break every `/apis/...` extension call, which is worse than a deprecation warning. That shim exists solely for pre-existing callers; do not write new code that depends on it.

## 6. Type style

- Co-locate request, response, and shared types with the resource class in the same file (or in a sibling file for sub-resources).
- Naming:
  - `Resource` — the entity returned by the API (`Agent`, `Session`, `MemoryStore`, `Vault`).
  - `ResourceCreateParams` / `ResourceUpdateParams` / `ResourceListParams` / `ResourceRetrieveParams` — request shapes.
  - `Deleted<Resource>` — tombstone responses when the server returns one (e.g. `DeletedMemoryStore`).
- List params extend `PageCursorParams`.
- Open shapes (where the server hasn't stabilised a schema) use `Record<string, unknown>` with a one-line comment explaining why.
- Use `import type` for type-only imports.
- Optional/nullable fields: use `?:` for optional, add `| null` only where the spec marks the field nullable in a request body.
- **Do not add a `beta_version` / `betaVersion` body field to a `*CreateParams`/`*UpdateParams` interface.** This SDK used to send one on several resources; it was removed because no core or cloud spec ever defined it as a request-body field (server tolerance for unknown fields is not the same as it being part of the contract), and sending it in the body causes a 400 from the hosted distribution's skill provider. Beta opt-in is a header concern — every method already accepts `{ headers: { 'orca-beta': '<value>' } }` via `RequestOptions`.

## 7. Pagination

The API uses two cursor shapes:

- Most lists accept `page` and return `next_page` (some also return nullable `prev_page`).
- File lists accept `after_id`/`before_id` and return `has_more`, `first_id`, and `last_id`.

`PageCursor` supports both: it follows `next_page` through `page`, or a file response's `last_id` through `after_id`. Match each method's parameter interface to its operation instead of extending `PageCursorParams` on ID-cursor lists. Page-token pattern:

```ts
list(
  params: VaultListParams = {},
  options?: RequestOptions,
): PagePromise<PageCursor<Vault>, Vault> {
  return this._client.getAPIList('/v1/vaults', PageCursor<Vault>, {
    query: params,
    ...options,
  });
}
```

Default `params` to `{}` so callers can omit it entirely.

## 8. Streaming (SSE)

SSE endpoints return `Promise<Stream<EventType>>` and use `Stream` from `../core/streaming`. If the spec gives the event a discriminated union, model it as one. Resource example: `Sessions.events.stream` in `src/resources/sessions/events.ts`.

## 9. Multipart uploads

Multipart endpoints (file upload, skill bundle upload) use `multipartFormRequestOptions` from `../internal/uploads`:

```ts
upload(params: FileUploadParams, options?: RequestOptions): APIPromise<FileMetadata> {
  return this._client.post(
    '/v1/files',
    multipartFormRequestOptions({ body: params, ...options }, this._client),
  );
}
```

File-typed fields use the `Uploadable` type. Callers can pass a `File`, a `Blob`, a `Buffer`, or anything produced by `toFile()`.

## 10. Errors

- Throw `Errors.OrcaError` (from `../core/error`) for client-side validation failures — missing config, malformed input, an apiKey callback returning empty. Construction errors only.
- Server errors are produced automatically by the request pipeline via `APIError.generate(...)`. Subclasses (`NotFoundError`, `RateLimitError`, `BadRequestError`, ...) are picked by status code.
- `Errors.ExtensionNotAvailableError` (also an `OrcaError` subclass, not an `APIError` one) is thrown when an `orca.cloud.*` call is gated off because `GET /apis` doesn't advertise the required group — see `BaseOrca.ensureExtensionAvailable` in `client.ts`. No HTTP request for the gated call itself is made, which is why it isn't an `APIError`.
- Never invent vendor-named error classes. We keep the lineup small and orthogonal.

## 11. Branding & naming

- Client class: `Orca` (subclass of `BaseOrca`, which owns the request pipeline).
- Environment variables: `ORCA_API_KEY`, `ORCA_BASE_URL`, `ORCA_LOG`.
- Error classes: `OrcaError`, `ExtensionNotAvailableError`, `APIError`, `APIConnectionError`, `APIConnectionTimeoutError`, `APIUserAbortError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `BadRequestError`, `AuthenticationError`, `InternalServerError`, `PermissionDeniedError`, `UnprocessableEntityError`.
- The `orca.cloud.*` extension group name is `cloud.sn.io`, single-sourced as `CLOUD_EXTENSION_GROUP` in `src/internal/constants.ts`. In prose (docs, READMEs, doc comments), call it the hosted extension group.
- Package: `@orca-ae/orca-sdk`.
- Public surface uses `orca.<resource>` (camelCase property names mounted on the client).

## 12. JSDoc

- Every public method gets a one-line summary plus at least one `@example` block showing realistic usage.
- Write plain prose. No vendor references. No ticket numbers. No links to internal docs that aren't part of this repo.
- Document non-obvious WHY — optimistic concurrency, write-only fields, tombstone returns, archive vs delete semantics. Don't restate the obvious "this creates an X" boilerplate.

## 13. Imports & module style

- Relative imports only. No path aliases.
- One blank line between import groups: `../core/...`, `../internal/...`, sibling resources, type-only imports.
- Barrel files (`index.ts`) re-export the resource class and a namespace for nested types (look at `src/resources/agents/index.ts` for the pattern).
- CommonJS-first build (`"type": "commonjs"` in package.json) with an ESM mirror; both come out of `dist/` via tsc-multi.

## 14. Tests

- Unit tests live under `tests/api-resources/<resource>/<method>.test.ts` (or grouped per file). They use `nock` to stub HTTP and assert path, headers, body, and query.
- Every method that takes `RequestOptions` must have one test exercising request-options pass-through (custom header propagation is the canonical assertion).
- Integration tests live under `tests/integration/<resource>.int.test.ts`. Set both `ORCA_TEST_BASE_URL` and `ORCA_TEST_API_KEY` to run them, or neither to skip them; `tests/integration/setup.ts` fails the suite when only one is set.
- End-to-end tests live under `tests/e2e/`: `sdk.test.cjs` runs the built SDK (`dist/`) directly against a kind/Helm deployment of the engine with a workspace API key (see `tests/e2e/README.md`). The proprietary hosted provider topology is excluded. The workflow skips when its source-access secret is missing and on fork pull requests, and uploads no artifacts because GitHub doesn't mask those. See CONTRIBUTING.md's CI configuration section for the secret.
- Smoke tests under `tests/smoke.test.ts` validate that the public surface (every property mounted on the `Orca` client) is reachable. Add to it when you add a new resource.

## 15. Unsupported cloud operation

The functional operations in `openapi/cloud-extensions.yaml` are exposed under `orca.cloud.*`. The one exception is `validateConfigs` (`PUT /connectors/kafka/connector-plugins/{pluginName}/config/validate`): its only declared response is HTTP 400, explicitly stating that validation is unsupported. Do not expose it until the contract defines a successful response.

## 16. Verification checklist before opening a PR

Run from the repo root:

```bash
yarn lint        # type-check, ESLint and license headers must be clean
yarn test        # Jest unit tests must pass
yarn build       # tsc-multi must emit dist/ without errors
```

Also confirm:

- Every new source file starts with the license header (`// Copyright The Orca Authors`, then `// SPDX-License-Identifier: Apache-2.0`; `#` comments in shell scripts and YAML, after any shebang). `node scripts/utils/license-headers.cjs --fix` adds missing headers.
- Commits are signed off by a human (DCO), and meaningful AI help is disclosed with an `Assisted-by:` trailer.

- `openapi/managed-agents-deployment.overlay.yaml` is refreshed and reviewed alongside core spec changes; every affected public request field or parameter has a compile-time assertion in `tests/managed-agents-deployment-overlay.test.ts`.
- `docs/surface-status.md` reflects the new/changed surface.
- `CHANGELOG.md` has an entry under the next version.
- New resources have at least one unit test per method plus one integration happy-path test.
- `git grep -nE "/v1/agents/(files|environments|memory_stores|skills|vaults|sessions)"` returns nothing — no accidental `/agents/` infix on non-agent resources.
- `git grep -nE ":archive\b"` only matches inside markdown, never in `src/`.
- `git grep -n "/v1/registry"` in `src/` only matches `client.ts` (the deprecation shim) and its comments — never a resource's request path.
- New `orca.cloud.*` methods route through `cloudGate()` (§5) and have a test proving `ExtensionNotAvailableError` — not a raw 404 — surfaces when the deployment doesn't advertise `cloud.sn.io`.

## 17. Adding a new resource — checklist

1. Confirm the resource and its operations exist in whichever spec governs its namespace (§1) — for core, check both `openapi/managed-agents.yaml` and `openapi/managed-agents-deployment.overlay.yaml`; for `orca.cloud.*`, check `openapi/cloud-extensions.yaml`.
2. Pick the right shape (flat file or folder with sub-resources). Create the source file(s).
3. Wire the resource into `src/client.ts` as a property on `Orca`, and into `src/resources/index.ts`.
4. Add the corresponding unit test file(s) under `tests/api-resources/...`.
5. Add an integration test under `tests/integration/<resource>.int.test.ts` covering the happy path.
6. Update `docs/surface-status.md` and `CHANGELOG.md`.
7. Run the verification checklist.
