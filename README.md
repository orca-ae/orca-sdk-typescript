# Orca TypeScript SDK

The TypeScript client for [Orca Agent Engine](https://github.com/orca-ae/orca-agent-engine), the open
runtime for managed AI agents. It covers the engine's core APIs (agents, sessions and their events,
environments, files, skills, vaults, memory stores and triggers), its policy and pricing extensions,
and the hosted extension group served by the hosted distribution.

For a command-line client, see the `ork` CLI (`brew install orca-ae/tap/ork`).

## Installation

Install the public package from [npmjs.org](https://www.npmjs.com/package/@orca-ae/orca-sdk).
No GitHub token or custom `.npmrc` is needed:

```sh
yarn add @orca-ae/orca-sdk
# or
npm install @orca-ae/orca-sdk
```

If you previously configured `@orca-ae:registry=https://npm.pkg.github.com/` in a project or user
`.npmrc`, remove that override (or change it to `https://registry.npmjs.org/`). Existing lockfiles
may also need refreshing to stop resolving this package through GitHub Packages.

Requires Node.js >= 20.

## Quickstart

```ts
import Orca from '@orca-ae/orca-sdk';

const orca = new Orca({
  apiKey: process.env.ORCA_API_KEY,
  baseURL: process.env.ORCA_BASE_URL,
});

const agent = await orca.agents.create({
  model: 'claude-sonnet-4-6',
  name: 'My First Agent',
});
console.log(agent.id);
```

## Authentication

The client accepts an `apiKey` option:

- **String** — used directly as a Bearer token.
- **Async function** — called per request; useful for token rotation. The function must return a non-empty string.
- **`null`** — disables the `Authorization` header entirely (useful when the server is behind a separately-authenticated proxy).

When `apiKey` is omitted, the SDK reads `process.env.ORCA_API_KEY`.

`baseURL` is required. It can be passed as a constructor option or set via `process.env.ORCA_BASE_URL`. Trailing slashes are stripped automatically.

### Base URL

`baseURL` is the **host root** — the client appends the full path itself, including its own `/v1` or `/apis/...` prefix:

```
ORCA_BASE_URL=https://workspace.example.com
  -> GET {base}/v1/agents
  -> GET {base}/apis/cloud.sn.io/v1/connections
```

If your `baseURL` still ends in `/v1/registry`, `/v1`, or `/api/v1` (what earlier versions of this SDK, or its docs, suggested), the client strips the whole suffix and logs a deprecation warning — existing configuration keeps working, but update it when convenient; the shim may be removed in a future major version. (`/api/v1` gets the full suffix stripped, not just the trailing `/v1` — stripping only `/v1` would leave core paths working via the `/api/v1/*` alias but silently break every `/apis/...` extension call.)

```ts
// Static key
const orca = new Orca({ apiKey: 'sk-...', baseURL: 'https://api.orca.example' });

// Dynamic key (token rotation)
const orca = new Orca({
  apiKey: async () => fetchFreshToken(),
  baseURL: process.env.ORCA_BASE_URL,
});

// No auth header
const orca = new Orca({ apiKey: null, baseURL: process.env.ORCA_BASE_URL });
```

## Streaming session events

```ts
const session = await orca.sessions.create({ agent: 'agent_id', environment_id: 'env_id' });

await orca.sessions.events.send(session.id, {
  events: [{ type: 'user.message', content: [{ type: 'text', text: 'Hello' }] }],
});

const stream = await orca.sessions.events.stream(session.id);
for await (const event of stream) {
  if (event.type === 'agent.message') console.log(event);
  if (event.type === 'session.status_idle') break;
}
```

## Session helper

`orca.session(sessionId)` returns an ergonomic handle that pre-fills the session ID for sub-resource calls:

```ts
const handle = orca.session('session_id');

await handle.events.send({
  events: [{ type: 'user.message', content: [{ type: 'text', text: 'Hello' }] }],
});

for await (const event of await handle.events.stream()) {
  console.log(event.type);
}

const fileResponse = await handle.files.download('file_id');
console.log(await fileResponse.arrayBuffer());

// Per-thread events
for await (const thread of handle.threads.list()) {
  for await (const event of await handle.threads.events.stream(thread.id)) {
    console.log(thread.id, event.type);
    break;
  }
}
```

## Session threads

A session has one primary thread plus zero or more child threads spawned by the coordinator. Threads are produced by the server; the SDK exposes read and archive operations plus per-thread event streaming:

```ts
for await (const thread of orca.sessions.threads.list('session_id')) {
  console.log(thread.id, thread.status);
}

const thread = await orca.sessions.threads.retrieve('session_id', 'thread_id');

const stream = await orca.sessions.threads.events.stream('session_id', 'thread_id');
for await (const event of stream) {
  if (event.type === 'agent.message') console.log(event);
}
```

## Memory stores

Memory stores are named containers attached to a session via `resources[]` to mount as a directory the agent can read and write:

```ts
const store = await orca.memoryStores.create({
  name: 'project-notes',
  description: 'Long-lived notes for project X',
});

const fetched = await orca.memoryStores.retrieve(store.id);

await orca.memoryStores.update(store.id, {
  description: 'Updated description',
});
```

## Triggers

Triggers are part of the core API, so the same `orca.triggers` client works against every supported deployment. The hosted distribution additionally accepts Kafka/Pulsar sources, all four session modes, and multiple replicas; deployments that implement only the narrower cron subset return an API error for unsupported combinations.

```ts
const trigger = await orca.triggers.create({
  name: 'daily-summary',
  agent: { type: 'agent', id: agent.id, version: agent.version },
  session_mode: 'SESSION_PER_EVENT',
  source: {
    type: 'cron',
    schedule: '0 9 * * *',
    timezone: 'Etc/UTC',
    payload: 'Summarize yesterday.',
  },
  session: { environment_id: 'env_id' },
});

await orca.triggers.pause(trigger.id);
await orca.triggers.unpause(trigger.id);
```

## Hosted extensions

`orca.cloud.*` covers operations in the hosted extension group, served under `/apis/cloud.sn.io/v1/*` by the hosted distribution — not the core engine, so a self-hosted engine doesn't serve them. Every method throws `ExtensionNotAvailableError` when called against a deployment that doesn't advertise the `cloud.sn.io` group (checked via `GET /apis` and cached per deployment URL):

```ts
import Orca, { ExtensionNotAvailableError } from '@orca-ae/orca-sdk';

try {
  const providers = await orca.cloud.agents.providers.list();
  console.log(providers);
} catch (err) {
  if (err instanceof ExtensionNotAvailableError) {
    console.log(`This deployment has no "${err.group}" extension installed.`);
  } else {
    throw err;
  }
}

// The provider registry lives here too.
const providers = await orca.cloud.agents.providers.list();
```

You can probe extension support directly instead of catching the error:

```ts
const { groups } = await orca.discovery.groups();
if (groups.some((g) => g.name === 'cloud.sn.io')) {
  // safe to call orca.cloud.*
}
```

## File upload

```ts
const file = new File(['hello\n'], 'hello.txt', { type: 'text/plain' });
const meta = await orca.files.upload({ file });
console.log(meta);
```

## Pagination

All list methods return an async iterable page cursor. You can iterate directly or consume a single page:

```ts
// Iterate all items across pages
for await (const agent of orca.agents.list()) {
  console.log(agent.id);
}

// Single page
const page = await orca.agents.list({ limit: 20 });
console.log(page.data);
```

## Error handling

All errors thrown by the SDK extend `OrcaError`. HTTP errors extend `APIError` and carry `.status`, `.headers`, and `.error` fields.

```ts
import Orca, { OrcaError, APIError, NotFoundError, RateLimitError } from '@orca-ae/orca-sdk';

try {
  await orca.agents.retrieve('missing_id');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.error('Agent not found:', err.status); // 404
  } else if (err instanceof RateLimitError) {
    console.error('Rate limited, retry after headers:', err.headers);
  } else if (err instanceof APIError) {
    console.error(err.status, err.message);
  } else if (err instanceof OrcaError) {
    console.error('SDK error:', err.message);
  } else {
    throw err;
  }
}
```

Available error subclasses:

| Class | HTTP status |
|---|---|
| `BadRequestError` | 400 |
| `AuthenticationError` | 401 |
| `PermissionDeniedError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `UnprocessableEntityError` | 422 |
| `RateLimitError` | 429 |
| `InternalServerError` | 5xx |
| `APIConnectionError` | — (network) |
| `APIConnectionTimeoutError` | — (timeout) |
| `APIUserAbortError` | — (aborted) |
| `ExtensionNotAvailableError` | — (client-side gate; see [Hosted extensions](#hosted-extensions)) |

## Retries and timeouts

The client automatically retries transient failures (network errors, 408, 409, 429, 5xx) with exponential backoff and jitter.

```ts
const orca = new Orca({
  apiKey: process.env.ORCA_API_KEY,
  baseURL: process.env.ORCA_BASE_URL,
  maxRetries: 3,    // default: 2
  timeout: 30_000,  // milliseconds; default: 600 000 (10 min)
});

// Per-request override
await orca.agents.list({}, { maxRetries: 0, timeout: 5_000 });
```

## Logging

Pass a `logger` option (any object with `debug`, `info`, `warn`, `error` methods) and set `logLevel` to control verbosity. Defaults to `console` at `'warn'`. Level can also be set via `process.env.ORCA_LOG`.

```ts
const orca = new Orca({
  apiKey: process.env.ORCA_API_KEY,
  baseURL: process.env.ORCA_BASE_URL,
  logger: console,
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
});
```

## Examples

Runnable scripts live in [`examples/`](./examples):

| Script | What it does |
|---|---|
| [`examples/quickstart.ts`](./examples/quickstart.ts) | Create an agent and environment, list agents, archive |
| [`examples/streaming-events.ts`](./examples/streaming-events.ts) | Send a message and stream SSE events until idle |
| [`examples/upload-file.ts`](./examples/upload-file.ts) | Upload a file, list files, delete |

Run an example (requires `ORCA_API_KEY` and `ORCA_BASE_URL` in the environment):

```sh
yarn examples:quickstart
yarn examples:streaming-events
yarn examples:upload-file
```

## Testing

```sh
yarn lint
yarn test
yarn build
```

Live API integration tests are documented in
[`tests/integration/README.md`](./tests/integration/README.md). The
Helm/Kind end-to-end suite against direct Managed Agents is documented in
[`tests/e2e/README.md`](./tests/e2e/README.md).

## Surface status

See [`docs/surface-status.md`](./docs/surface-status.md) for a full breakdown of which API surfaces are implemented and what is intentionally absent.

## Getting help

- **Questions and ideas:** [GitHub Discussions](https://github.com/orca-ae/orca-sdk-typescript/discussions).
- **Bugs and feature requests:** [GitHub Issues](https://github.com/orca-ae/orca-sdk-typescript/issues). If the engine itself misbehaves, use [Orca Agent Engine's issues](https://github.com/orca-ae/orca-agent-engine/issues).
- **Security vulnerabilities:** report them privately, as described in [SECURITY.md](./SECURITY.md).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md). If you use AI tools, read the [AI policy](./AI_POLICY.md); coding agents should read [AGENTS.md](./AGENTS.md).

## License

Licensed under the [Apache License 2.0](./LICENSE). See [NOTICE](./NOTICE) for attributions.
