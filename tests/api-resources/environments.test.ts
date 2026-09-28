// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Environments resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../src/client';
import type { OrcaOptions } from '../../src/client';
import { PageCursor } from '../../src/core/pagination';
import type { Environment } from '../../src/resources/environments';
import type { Fetch, RequestInfo } from '../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENV_FIXTURE: Environment = {
  id: 'env_abc123',
  type: 'environment',
  name: 'production',
  description: 'Production environment',
  config: {
    type: 'cloud',
    packages: {
      type: 'packages',
      apt: [],
      cargo: [],
      gem: [],
      go: [],
      npm: ['tsx'],
      pip: [],
    },
    networking: { type: 'limited', allowed_hosts: ['api.example.com'] },
  },
  metadata: { team: 'ops' },
  scope: 'organization',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResp(status = 204): Response {
  return new Response(null, { status });
}

type Handlers = Record<string, () => Response>;

function makeFakeFetch(handlers: Handlers): Fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;

    const entry = Object.entries(handlers).find(([k]) => url.includes(k));
    if (!entry) throw new Error(`unhandled URL: ${url}`);
    return entry[1]();
  };
}

type CapturedCall = { url: string; init: RequestInit | undefined };

function makeClient(
  fakeFetch?: Fetch,
  opts: Partial<OrcaOptions> = {},
): { orca: Orca; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];

  const capturingFetch: Fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;
    calls.push({ url, init });
    if (fakeFetch) return fakeFetch(input, init);
    return jsonResp(ENV_FIXTURE);
  };

  const orca = new Orca({
    apiKey: 'test-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: capturingFetch as unknown as typeof fetch,
    ...opts,
  });

  return { orca, calls };
}

// ---------------------------------------------------------------------------
// 1. create()
// ---------------------------------------------------------------------------

describe('Environments.create()', () => {
  it('sends POST to /v1/environments with required fields', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.create({ name: 'production' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/environments');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.name).toBe('production');
  });

  it('serializes all optional fields correctly', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.create({
      name: 'staging',
      description: 'Staging environment',
      config: {
        type: 'cloud',
        packages: { type: 'packages', pip: ['requests'] },
        networking: {
          type: 'limited',
          allowed_hosts: ['api.example.com'],
          allow_package_managers: true,
        },
      },
      metadata: { team: 'platform', env: 'staging' },
      scope: 'organization',
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.name).toBe('staging');
    expect(body.description).toBe('Staging environment');
    expect(body.config).toEqual({
      type: 'cloud',
      packages: { type: 'packages', pip: ['requests'] },
      networking: {
        type: 'limited',
        allowed_hosts: ['api.example.com'],
        allow_package_managers: true,
      },
    });
    expect(body.metadata).toEqual({ team: 'platform', env: 'staging' });
    expect(body.scope).toBe('organization');
  });

  it('accepts config without discriminators and preserves nullable values', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.create({
      name: 'minimal-config',
      config: {
        packages: { apt: ['curl'], pip: null },
        networking: null,
      },
    });

    expect(JSON.parse(calls[0]!.init?.body as string).config).toEqual({
      packages: { apt: ['curl'], pip: null },
      networking: null,
    });
  });
});

// ---------------------------------------------------------------------------
// 2. retrieve()
// ---------------------------------------------------------------------------

describe('Environments.retrieve()', () => {
  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient();
    const environment = await orca.environments.retrieve('env_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/environments/env_abc123');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
    expect(environment.scope).toBe('organization');
    expect(environment.archived_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. update()
// ---------------------------------------------------------------------------

describe('Environments.update()', () => {
  it('sends POST to the correct URL', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.update('env_abc123', { name: 'updated-name' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/environments/env_abc123');
    expect(call.init?.method?.toUpperCase()).toBe('POST');
  });

  it('serializes all update fields in body', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.update('env_abc123', {
      name: 'renamed',
      description: 'Updated description',
      config: { type: 'self_hosted' },
      metadata: { updated: 'true' },
      scope: 'account',
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.name).toBe('renamed');
    expect(body.description).toBe('Updated description');
    expect(body.config).toEqual({ type: 'self_hosted' });
    expect(body.metadata).toEqual({ updated: 'true' });
    expect(body.scope).toBe('account');
  });

  it('allows partial updates (only name)', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.update('env_abc123', { name: 'only-name' });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.name).toBe('only-name');
    expect(body.description).toBeUndefined();
  });

  it('serializes null metadata values used to remove keys', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.update('env_abc123', {
      metadata: { keep: 'yes', obsolete: null },
    });

    expect(JSON.parse(calls[0]!.init?.body as string).metadata).toEqual({
      keep: 'yes',
      obsolete: null,
    });
  });

  it('accepts nullable package and limited-networking values', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.update('env_abc123', {
      config: {
        packages: null,
        networking: {
          type: 'limited',
          allowed_hosts: null,
          allow_mcp_servers: null,
          allow_package_managers: null,
        },
      },
    });

    expect(JSON.parse(calls[0]!.init?.body as string).config).toEqual({
      packages: null,
      networking: {
        type: 'limited',
        allowed_hosts: null,
        allow_mcp_servers: null,
        allow_package_managers: null,
      },
    });
  });
});

// ---------------------------------------------------------------------------
// 4. list()
// ---------------------------------------------------------------------------

describe('Environments.list()', () => {
  const pageBody = {
    data: [ENV_FIXTURE],
    has_more: false,
    first_id: ENV_FIXTURE.id,
    last_id: ENV_FIXTURE.id,
  };

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(
      makeFakeFetch({ '/v1/environments': () => jsonResp(pageBody) }),
    );
    const page = await orca.environments.list();
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.id).toBe(ENV_FIXTURE.id);
  });

  it('forwards limit and include_archived as query params', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/environments': () => jsonResp(pageBody) }),
    );
    await orca.environments.list({ limit: 25, include_archived: true });

    const url = calls[0]!.url;
    expect(url).toContain('limit=25');
    expect(url).toContain('include_archived=true');
  });

  it('supports async iteration over paged results', async () => {
    const page1 = {
      data: [{ ...ENV_FIXTURE, id: 'env_1' }],
      has_more: true,
      last_id: 'env_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ ...ENV_FIXTURE, id: 'env_2' }],
      has_more: false,
      last_id: 'env_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const env of orca.environments.list()) {
      ids.push(env.id);
    }

    expect(ids).toEqual(['env_1', 'env_2']);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. delete()
// ---------------------------------------------------------------------------

describe('Environments.delete()', () => {
  it('sends DELETE and returns the deletion tombstone', async () => {
    const tombstone = { id: 'env_abc123', type: 'environment_deleted' as const };
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/environments/': () => jsonResp(tombstone) }),
    );
    const result = await orca.environments.delete('env_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/environments/env_abc123');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(result).toEqual(tombstone);
  });
});

// ---------------------------------------------------------------------------
// 6. archive()
// ---------------------------------------------------------------------------

describe('Environments.archive()', () => {
  it('sends POST and returns the archived environment', async () => {
    const archived = { ...ENV_FIXTURE, archived_at: '2026-01-02T00:00:00Z' };
    const { orca, calls } = makeClient(
      makeFakeFetch({ 'environments/env_abc123/archive': () => jsonResp(archived) }),
    );
    const result = await orca.environments.archive('env_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/environments/env_abc123/archive',
    );
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(result).toEqual(archived);
  });
});

// ---------------------------------------------------------------------------
// 7. URL encoding
// ---------------------------------------------------------------------------

describe('URL encoding', () => {
  it('encodes envId with special characters in retrieve', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.retrieve('env/with/slash');

    expect(calls[0]!.url).toContain('env%2Fwith%2Fslash');
    expect(calls[0]!.url).not.toContain('/env/with/slash');
  });

  it('encodes envId with special characters in update', async () => {
    const { orca, calls } = makeClient();
    await orca.environments.update('env/slash', { name: 'x' });

    expect(calls[0]!.url).toContain('env%2Fslash');
  });

  it('encodes envId with special characters in delete', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/environments/': () => emptyResp(204) }),
    );
    await orca.environments.delete('env/slash');

    expect(calls[0]!.url).toContain('env%2Fslash');
  });
});
