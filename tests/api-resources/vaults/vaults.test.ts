// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Vaults resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { Vault } from '../../../src/resources/vaults/vaults';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VAULT_FIXTURE: Vault = {
  id: 'vault_abc123',
  type: 'vault',
  display_name: 'Test Vault',
  metadata: { team: 'platform' },
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
    return jsonResp(VAULT_FIXTURE);
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

describe('Vaults.create()', () => {
  it('sends POST to /v1/vaults with body', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.create({ display_name: 'My Vault' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/vaults');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.display_name).toBe('My Vault');
  });

  it('serializes all optional fields correctly', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.create({
      display_name: 'Full Vault',
      metadata: { env: 'prod', owner: 'alice' },
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.display_name).toBe('Full Vault');
    expect(body.metadata).toEqual({ env: 'prod', owner: 'alice' });
  });
});

// ---------------------------------------------------------------------------
// 2. retrieve()
// ---------------------------------------------------------------------------

describe('Vaults.retrieve()', () => {
  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.retrieve('vault_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/vaults/vault_abc123');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('exposes required response fields with their wire nullability', async () => {
    const { orca } = makeClient();
    const vault = await orca.vaults.retrieve('vault_abc123');
    const displayName: string = vault.display_name;
    const metadata: Record<string, string> = vault.metadata;
    const archivedAt: string | null = vault.archived_at;

    expect(displayName).toBe('Test Vault');
    expect(metadata).toEqual({ team: 'platform' });
    expect(archivedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. update()
// ---------------------------------------------------------------------------

describe('Vaults.update()', () => {
  it('sends POST to the correct URL', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.update('vault_abc123', { display_name: 'Renamed Vault' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/vaults/vault_abc123');
    expect(call.init?.method?.toUpperCase()).toBe('POST');
  });

  it('serializes update body correctly', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.update('vault_abc123', {
      display_name: 'New Name',
      metadata: { updated: 'yes' },
    });

    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.display_name).toBe('New Name');
    expect(body.metadata).toEqual({ updated: 'yes' });
  });

  it('serializes nulls used to clear vault fields and metadata keys', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.update('vault_abc123', {
      display_name: null,
      metadata: { obsolete: null },
    });

    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      display_name: null,
      metadata: { obsolete: null },
    });
  });
});

// ---------------------------------------------------------------------------
// 4. list()
// ---------------------------------------------------------------------------

describe('Vaults.list()', () => {
  const pageBody = {
    data: [VAULT_FIXTURE],
    has_more: false,
    first_id: VAULT_FIXTURE.id,
    last_id: VAULT_FIXTURE.id,
  };

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(
      makeFakeFetch({ '/v1/vaults': () => jsonResp(pageBody) }),
    );
    const page = await orca.vaults.list();
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.id).toBe(VAULT_FIXTURE.id);
  });

  it('forwards limit and include_archived as query params', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/vaults': () => jsonResp(pageBody) }),
    );
    await orca.vaults.list({ limit: 25, include_archived: true });

    const url = calls[0]!.url;
    expect(url).toContain('limit=25');
    expect(url).toContain('include_archived=true');
  });

  it('supports async iteration over paged results', async () => {
    const page1 = {
      data: [{ ...VAULT_FIXTURE, id: 'vault_1' }],
      has_more: true,
      last_id: 'vault_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ ...VAULT_FIXTURE, id: 'vault_2' }],
      has_more: false,
      last_id: 'vault_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const vault of orca.vaults.list()) {
      ids.push(vault.id);
    }

    expect(ids).toEqual(['vault_1', 'vault_2']);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. delete()
// ---------------------------------------------------------------------------

describe('Vaults.delete()', () => {
  it('sends DELETE and returns the deletion tombstone', async () => {
    const tombstone = { id: 'vault_abc123', type: 'vault_deleted' as const };
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/vaults/': () => jsonResp(tombstone) }),
    );
    const result = await orca.vaults.delete('vault_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/vaults/vault_abc123');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(result).toEqual(tombstone);
  });
});

// ---------------------------------------------------------------------------
// 6. archive()
// ---------------------------------------------------------------------------

describe('Vaults.archive()', () => {
  it('sends POST and returns the archived vault', async () => {
    const archived = { ...VAULT_FIXTURE, archived_at: '2026-01-02T00:00:00Z' };
    const { orca, calls } = makeClient(
      makeFakeFetch({ 'vault_abc123/archive': () => jsonResp(archived) }),
    );
    const result = await orca.vaults.archive('vault_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/vaults/vault_abc123/archive');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(result).toEqual(archived);
  });

  it('URL-encodes vaultId in the archive path', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/archive': () => jsonResp(VAULT_FIXTURE) }),
    );
    await orca.vaults.archive('vault/slash');

    expect(calls[0]!.url).toContain('vault%2Fslash/archive');
  });
});

// ---------------------------------------------------------------------------
// 7. URL encoding
// ---------------------------------------------------------------------------

describe('URL encoding', () => {
  it('encodes vaultId with special characters in retrieve', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.retrieve('vault/with/slash');

    expect(calls[0]!.url).toContain('vault%2Fwith%2Fslash');
    expect(calls[0]!.url).not.toContain('/vault/with/slash');
  });

  it('encodes vaultId with special characters in update', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.update('vault/slash', { display_name: 'test' });

    expect(calls[0]!.url).toContain('vault%2Fslash');
  });

  it('encodes vaultId with special characters in delete', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/vaults/': () => jsonResp({ id: 'vault/slash', type: 'vault_deleted' }) }),
    );
    await orca.vaults.delete('vault/slash');

    expect(calls[0]!.url).toContain('vault%2Fslash');
  });
});
