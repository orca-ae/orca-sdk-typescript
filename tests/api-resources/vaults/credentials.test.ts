// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Vaults Credentials sub-resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type {
  CredentialUpdateParams,
  CredentialValidation,
  VaultCredential,
} from '../../../src/resources/vaults';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREDENTIAL_FIXTURE: VaultCredential = {
  id: 'cred_abc123',
  type: 'vault_credential',
  vault_id: 'vault_abc123',
  display_name: 'Test Credential',
  auth: { type: 'static_bearer', mcp_server_url: 'https://mcp.example.com' },
  metadata: { team: 'platform' },
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
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
    return jsonResp(CREDENTIAL_FIXTURE);
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
// 1. list()
// ---------------------------------------------------------------------------

describe('Vaults.credentials.list()', () => {
  const pageBody = {
    data: [CREDENTIAL_FIXTURE],
    has_more: false,
    first_id: CREDENTIAL_FIXTURE.id,
    last_id: CREDENTIAL_FIXTURE.id,
  };

  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/vaults/vault_abc123/credentials': () => jsonResp(pageBody) }),
    );
    await orca.vaults.credentials.list('vault_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/vaults/vault_abc123/credentials');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(
      makeFakeFetch({ '/v1/vaults/': () => jsonResp(pageBody) }),
    );
    const page = await orca.vaults.credentials.list('vault_abc123');
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect((page.data[0] as { id: string }).id).toBe(CREDENTIAL_FIXTURE.id);
  });

  it('forwards include_archived as a query param', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/vaults/': () => jsonResp(pageBody) }),
    );
    await orca.vaults.credentials.list('vault_abc123', { include_archived: true });

    expect(new URL(calls[0]!.url).searchParams.get('include_archived')).toBe('true');
  });

  it('forwards pagination query params', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/vaults/': () => jsonResp(pageBody) }),
    );
    await orca.vaults.credentials.list('vault_abc123', { limit: 10, page: 'cursor-1' });

    const search = new URL(calls[0]!.url).searchParams;
    expect(search.get('limit')).toBe('10');
    expect(search.get('page')).toBe('cursor-1');
  });

  it('supports async iteration over paged results', async () => {
    const page1 = {
      data: [{ ...CREDENTIAL_FIXTURE, id: 'cred_1' }],
      has_more: true,
      last_id: 'cred_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ ...CREDENTIAL_FIXTURE, id: 'cred_2' }],
      has_more: false,
      last_id: 'cred_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const cred of orca.vaults.credentials.list('vault_abc123')) {
      ids.push((cred as { id: string }).id);
    }

    expect(ids).toEqual(['cred_1', 'cred_2']);
    expect(callCount).toBe(2);
  });

  it('URL-encodes vaultId', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/credentials': () => jsonResp(pageBody) }),
    );
    await orca.vaults.credentials.list('vault/slash');

    expect(calls[0]!.url).toContain('vault%2Fslash');
    expect(calls[0]!.url).not.toContain('/vault/slash/credentials');
  });
});

// ---------------------------------------------------------------------------
// 2. create()
// ---------------------------------------------------------------------------

describe('Vaults.credentials.create()', () => {
  it('sends POST to the correct URL with body', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.credentials.create('vault_abc123', {
      display_name: 'New Credential',
      auth: {
        type: 'static_bearer',
        token: 'secret',
        mcp_server_url: 'https://mcp.example.com',
      },
      metadata: { owner: 'platform' },
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain('/v1/vaults/vault_abc123/credentials');
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.display_name).toBe('New Credential');
    expect(body.auth).toEqual({
      type: 'static_bearer',
      token: 'secret',
      mcp_server_url: 'https://mcp.example.com',
    });
    expect(body.metadata).toEqual({ owner: 'platform' });
  });

  it('serializes environment-variable authentication', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.credentials.create('vault_abc123', {
      auth: {
        type: 'environment_variable',
        secret_name: 'SERVICE_TOKEN',
        secret_value: 'secret',
        networking: { type: 'limited', allowed_hosts: ['api.example.com'] },
        injection_location: { header: true },
      },
    });

    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0]!.init?.body as string).auth.type).toBe(
      'environment_variable',
    );
  });

  it('URL-encodes vaultId', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.credentials.create('vault/slash', {
      display_name: 'cred',
      auth: {
        type: 'static_bearer',
        token: 'secret',
        mcp_server_url: 'https://mcp.example.com',
      },
    });

    expect(calls[0]!.url).toContain('vault%2Fslash');
    expect(calls[0]!.url).not.toContain('/vault/slash/credentials');
  });
});

// ---------------------------------------------------------------------------
// 3. delete()
// ---------------------------------------------------------------------------

describe('Vaults.credentials.delete()', () => {
  it('sends DELETE and returns the deletion tombstone', async () => {
    const tombstone = { id: 'cred_abc123', type: 'vault_credential_deleted' as const };
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/credentials/': () => jsonResp(tombstone) }),
    );
    const result = await orca.vaults.credentials.delete('vault_abc123', 'cred_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/vaults/vault_abc123/credentials/cred_abc123',
    );
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(result).toEqual(tombstone);
  });

  it('URL-encodes both vaultId and credentialId', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/credentials/': () => jsonResp({ id: 'cred/slash', type: 'vault_credential_deleted' }) }),
    );
    await orca.vaults.credentials.delete('vault/slash', 'cred/slash');

    expect(calls[0]!.url).toContain('vault%2Fslash');
    expect(calls[0]!.url).toContain('cred%2Fslash');
  });
});

// ---------------------------------------------------------------------------
// 4. retrieve()
// ---------------------------------------------------------------------------

describe('Vaults.credentials.retrieve()', () => {
  it('sends GET to the credential item URL', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.credentials.retrieve('vault_abc123', 'cred_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/vaults/vault_abc123/credentials/cred_abc123',
    );
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });
});

// ---------------------------------------------------------------------------
// 5. update()
// ---------------------------------------------------------------------------

describe('Vaults.credentials.update()', () => {
  it('sends POST to the credential item URL with body', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.credentials.update('vault_abc123', 'cred_abc123', {
      display_name: 'Renamed',
      metadata: { owner: 'platform' },
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain(
      '/v1/vaults/vault_abc123/credentials/cred_abc123',
    );
    // updateCredential is POST per the OpenAPI spec.
    expect(call.init?.method?.toUpperCase()).toBe('POST');

    const body = JSON.parse(call.init?.body as string);
    expect(body.display_name).toBe('Renamed');
    expect(body.metadata).toEqual({ owner: 'platform' });
  });

  it('serializes discriminated auth updates with nullable secret fields', async () => {
    const { orca, calls } = makeClient();
    await orca.vaults.credentials.update('vault_abc123', 'cred_abc123', {
      auth: { type: 'static_bearer', token: null },
      metadata: { obsolete: null },
    });

    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      auth: { type: 'static_bearer', token: null },
      metadata: { obsolete: null },
    });
  });

  it('requires an auth discriminator at compile time', () => {
    const params: CredentialUpdateParams = {
      // @ts-expect-error Credential auth updates require a type discriminator.
      auth: {},
    };
    expect(params.auth).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 6. archive()
// ---------------------------------------------------------------------------

describe('Vaults.credentials.archive()', () => {
  it('sends POST and returns the archived credential', async () => {
    const archived = { ...CREDENTIAL_FIXTURE, archived_at: '2026-01-02T00:00:00Z' };
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/archive': () => jsonResp(archived) }),
    );
    const result = await orca.vaults.credentials.archive('vault_abc123', 'cred_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/vaults/vault_abc123/credentials/cred_abc123/archive',
    );
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(result).toEqual(archived);
  });
});

// ---------------------------------------------------------------------------
// 7. validate()
// ---------------------------------------------------------------------------

describe('Vaults.credentials.validate()', () => {
  it('sends POST and returns the typed validation result', async () => {
    const validation: CredentialValidation = {
      type: 'vault_credential_validation',
      credential_id: 'cred_abc123',
      vault_id: 'vault_abc123',
      validated_at: '2026-01-02T00:00:00Z',
      has_refresh_token: true,
      status: 'valid',
      mcp_probe: { method: 'initialize', http_response: null },
      refresh: { status: 'succeeded', http_response: null },
    };
    const { orca, calls } = makeClient(async () => jsonResp(validation));
    const result = await orca.vaults.credentials.validate('vault_abc123', 'cred_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      '/v1/vaults/vault_abc123/credentials/cred_abc123/mcp_oauth_validate',
    );
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('POST');
    expect(result.status).toBe('valid');
    expect(result).toEqual(validation);
  });
});
