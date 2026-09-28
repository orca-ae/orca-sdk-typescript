// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Skills resource.
 *
 * Uses an injected fake fetch so tests are fully hermetic — no real network
 * calls are made.
 */

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { Skill } from '../../../src/resources/skills';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SKILL_FIXTURE: Skill = {
  id: 'skill_abc123',
  type: 'skill',
  display_title: 'Test Skill',
  latest_version: '1.0.0',
  source: 'custom',
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
    return jsonResp(SKILL_FIXTURE);
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

describe('Skills.create()', () => {
  it('sends POST to /v1/skills with FormData body', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['hello'], 'skill.wasm', { type: 'application/wasm' });
    await orca.skills.create({ files: [file] });

    const real = apiCalls(calls);
    expect(real).toHaveLength(1);
    const call = real[0]!;
    expect(call.url).toContain('/v1/skills');
    expect(call.init?.method?.toUpperCase()).toBe('POST');
    expect(call.init?.body).toBeInstanceOf(FormData);
  });

  it('includes every file in the files array', async () => {
    const { orca, calls } = makeClient();
    const first = new File(['wasm'], 'skill.wasm', { type: 'application/wasm' });
    const second = new File(['docs'], 'README.md', { type: 'text/markdown' });
    await orca.skills.create({ files: [first, second] });

    const real = apiCalls(calls);
    const body = real[0]!.init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const entries = body.getAll('files[]');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toBeInstanceOf(File);
    expect((entries[0] as File).name).toBe('skill.wasm');
    expect((entries[1] as File).name).toBe('README.md');
  });

  it('preserves bundle-relative paths in multipart filenames', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['instructions'], 'test-skill/SKILL.md', {
      type: 'text/markdown',
    });
    await orca.skills.create({ files: [file] });

    const real = apiCalls(calls);
    const body = real[0]!.init?.body as FormData;
    const entry = body.get('files[]');
    expect(entry).toBeInstanceOf(File);
    expect((entry as File).name).toBe('test-skill/SKILL.md');
  });

  it('includes display_title in FormData', async () => {
    const { orca, calls } = makeClient();
    const file = new File(['wasm'], 'skill.wasm');
    await orca.skills.create({ files: [file], display_title: 'My Skill' });

    const real = apiCalls(calls);
    const body = real[0]!.init?.body as FormData;
    expect(body.get('display_title')).toBe('My Skill');
  });
});

// ---------------------------------------------------------------------------
// 2. retrieve()
// ---------------------------------------------------------------------------

describe('Skills.retrieve()', () => {
  it('sends GET to the correct URL', async () => {
    const { orca, calls } = makeClient();
    await orca.skills.retrieve('skill_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/skills/skill_abc123');
    expect((calls[0]!.init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('URL-encodes skillId with special characters', async () => {
    const { orca, calls } = makeClient();
    await orca.skills.retrieve('skill/with/slash');

    expect(calls[0]!.url).toContain('skill%2Fwith%2Fslash');
    expect(calls[0]!.url).not.toContain('/skill/with/slash');
  });
});

// ---------------------------------------------------------------------------
// 3. list()
// ---------------------------------------------------------------------------

describe('Skills.list()', () => {
  const pageBody = {
    data: [SKILL_FIXTURE],
    has_more: false,
    first_id: SKILL_FIXTURE.id,
    last_id: SKILL_FIXTURE.id,
  };

  it('returns a PageCursor on await', async () => {
    const { orca } = makeClient(
      makeFakeFetch({ '/v1/skills': () => jsonResp(pageBody) }),
    );
    const page = await orca.skills.list();
    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toHaveLength(1);
    expect((page.data[0] as { id: string }).id).toBe(SKILL_FIXTURE.id);
  });

  it('forwards limit as a query param', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/skills': () => jsonResp(pageBody) }),
    );
    await orca.skills.list({ limit: 20 });

    const url = calls[0]!.url;
    expect(url).toContain('limit=20');
  });

  it('supports async iteration over paged results', async () => {
    const page1 = {
      data: [{ ...SKILL_FIXTURE, id: 'skill_1' }],
      has_more: true,
      last_id: 'skill_1',
      next_page: 'cursor-p2',
    };
    const page2 = {
      data: [{ ...SKILL_FIXTURE, id: 'skill_2' }],
      has_more: false,
      last_id: 'skill_2',
    };

    let callCount = 0;
    const fakeFetch: Fetch = async () => {
      callCount++;
      return jsonResp(callCount === 1 ? page1 : page2);
    };

    const { orca } = makeClient(fakeFetch);
    const ids: string[] = [];
    for await (const skill of orca.skills.list()) {
      ids.push((skill as { id: string }).id);
    }

    expect(ids).toEqual(['skill_1', 'skill_2']);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. delete()
// ---------------------------------------------------------------------------

describe('Skills.delete()', () => {
  it('sends DELETE and returns the deletion tombstone', async () => {
    const tombstone = { id: 'skill_abc123', type: 'skill_deleted' as const };
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/skills/': () => jsonResp(tombstone) }),
    );
    const result = await orca.skills.delete('skill_abc123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/skills/skill_abc123');
    expect(calls[0]!.init?.method?.toUpperCase()).toBe('DELETE');
    expect(result).toEqual(tombstone);
  });

  it('URL-encodes skillId with special characters', async () => {
    const { orca, calls } = makeClient(
      makeFakeFetch({ '/v1/skills/': () => jsonResp({ id: 'skill/slash', type: 'skill_deleted' }) }),
    );
    await orca.skills.delete('skill/slash');

    expect(calls[0]!.url).toContain('skill%2Fslash');
  });
});
