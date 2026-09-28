// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Skills Versions sub-resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { SkillVersion } from '../../../src/resources/skills';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VERSION_FIXTURE: SkillVersion = {
  id: 'version_abc123',
  skill_id: 'skill_abc123',
  type: 'skill_version',
  name: 'Test Skill',
  description: 'A test skill',
  directory: 'test-skill',
  version: '1.0.0',
  created_at: '2026-01-01T00:00:00Z',
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
    return jsonResp(VERSION_FIXTURE);
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

// The multipart helper probes the fetch function with a `data:,` request to
// check FormData support. We filter those out to get only real API calls.
function apiCalls(calls: CapturedCall[]): CapturedCall[] {
  return calls.filter((c) => !c.url.startsWith('data:'));
}

// ---------------------------------------------------------------------------
// 1. create()
// ---------------------------------------------------------------------------

describe('Skills.versions.create()', () => {
  it('sends POST to /v1/skills/{skillId}/versions with FormData body', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['wasm'], 'v2.wasm', { type: 'application/wasm' });
    await orca.skills.versions.create('skill_abc123', { files: [file] });

    const real = apiCalls(calls);
    expect(real).toHaveLength(1);
    const call = real[0]!;
    expect(call.url).toContain('/v1/skills/skill_abc123/versions');
    expect(call.init?.method?.toUpperCase()).toBe('POST');
    expect(call.init?.body).toBeInstanceOf(FormData);
  });

  it('includes files in FormData', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['wasm'], 'v2.wasm', { type: 'application/wasm' });
    await orca.skills.versions.create('skill_abc123', { files: [file] });

    const real = apiCalls(calls);
    const body = real[0]!.init?.body as FormData;
    const entry = body.get('files[]');
    expect(entry).toBeInstanceOf(File);
    expect((entry as File).name).toBe('v2.wasm');
  });

  it('preserves bundle-relative paths in multipart filenames', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['updated instructions'], 'test-skill/SKILL.md', {
      type: 'text/markdown',
    });
    await orca.skills.versions.create('skill_abc123', { files: [file] });

    const real = apiCalls(calls);
    const body = real[0]!.init?.body as FormData;
    const entry = body.get('files[]');
    expect(entry).toBeInstanceOf(File);
    expect((entry as File).name).toBe('test-skill/SKILL.md');
  });

  it('URL-encodes skillId', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['wasm'], 'skill.wasm');
    await orca.skills.versions.create('skill/slash', { files: [file] });

    const real = apiCalls(calls);
    expect(real[0]!.url).toContain('skill%2Fslash');
    expect(real[0]!.url).not.toContain('/skill/slash/versions');
  });
});

// ---------------------------------------------------------------------------
// 2. list()
// ---------------------------------------------------------------------------

describe('Skills.versions.list()', () => {
  const pageBody = {
    data: [VERSION_FIXTURE],
    has_more: false,
    first_id: VERSION_FIXTURE.id,
    last_id: VERSION_FIXTURE.id,
  };

  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/skills/skill_abc123/versions': () => jsonResp(pageBody) }),
    );
    await orca.skills.versions.list('skill_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/skills/skill_abc123/versions');
  });

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(
      makeFakeFetch({ '/v1/skills/': () => jsonResp(pageBody) }),
    );
    const page = await orca.skills.versions.list('skill_abc123');
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
  });

  it('forwards limit and page as query params', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/skills/': () => jsonResp(pageBody) }),
    );
    await orca.skills.versions.list('skill_abc123', { limit: 5, page: 'cursor-abc' });

    const url = calls[0]!.url;
    expect(url).toContain('limit=5');
    expect(url).toContain('page=cursor-abc');
  });

  it('supports async iteration over paged results', async () => {
    const page1 = {
      data: [{ ...VERSION_FIXTURE, id: 'ver_1', version: '1.0.0' }],
      has_more: true,
      last_id: 'ver_1',
      next_page: 'cursor-v2',
    };
    const page2 = {
      data: [{ ...VERSION_FIXTURE, id: 'ver_2', version: '2.0.0' }],
      has_more: false,
      last_id: 'ver_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const ver of orca.skills.versions.list('skill_abc123')) {
      ids.push((ver as { id: string }).id);
    }

    expect(ids).toEqual(['ver_1', 'ver_2']);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. retrieve()
// ---------------------------------------------------------------------------

describe('Skills.versions.retrieve()', () => {
  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient();
    await orca.skills.versions.retrieve('skill_abc123', '1.0.0');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/skills/skill_abc123/versions/1.0.0');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('URL-encodes skillId and version', async () => {
    const { orca, calls } = makeClient();
    await orca.skills.versions.retrieve('skill/slash', 'v1/v2');

    expect(calls[0]!.url).toContain('skill%2Fslash');
    expect(calls[0]!.url).toContain('v1%2Fv2');
  });
});

// ---------------------------------------------------------------------------
// 4. delete()
// ---------------------------------------------------------------------------

describe('Skills.versions.delete()', () => {
  it('sends DELETE and returns the deletion tombstone', async () => {
    const tombstone = { id: 'version_abc123', type: 'skill_version_deleted' as const };
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/skills/': () => jsonResp(tombstone) }),
    );
    const result = await orca.skills.versions.delete('skill_abc123', '1.0.0');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/skills/skill_abc123/versions/1.0.0');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(result).toEqual(tombstone);
  });
});
