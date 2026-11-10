// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../src/client';
import { ExtensionNotAvailableError, APIUserAbortError } from '../src/core/error';
import type { RequestOptions } from '../src/internal/request-options';

const pricing = 'pricing.runorca.ai';
const cloud = 'cloud.sn.io';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const discovery = (versions: string[], includePricing = true) =>
  json({
    kind: 'APIGroupList',
    groups: [cloud, ...(includePricing ? [pricing] : [])].map((name) => ({
      name,
      versions: (name === cloud ? ['v1'] : versions).map((version) => ({ version })),
    })),
  });

function setup() {
  let response = () => discovery(['v1']);
  const fetch = jest.fn(async (_input: unknown, _init?: RequestInit) => response());
  const orca = new Orca({ apiKey: 'key', baseURL: 'https://api.example.test', maxRetries: 0, fetch });
  return {
    orca,
    fetch,
    respond: (next: () => Response) => {
      response = next;
    },
  };
}

describe('missing extension capability recovery', () => {
  let now = 1000;
  beforeEach(() => {
    now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  test.each([true, false])(
    'recovers pricing v2 on the same client (initial pricing group=%s)',
    async (includePricing) => {
      const { orca, fetch, respond } = setup();
      respond(() => discovery(['v1'], includePricing));
      await expect(orca.modelPriceRules.list()).rejects.toBeInstanceOf(ExtensionNotAvailableError);
      now += 14999;
      await expect(orca.modelPriceRules.list()).rejects.toBeInstanceOf(ExtensionNotAvailableError);
      expect(fetch).toHaveBeenCalledTimes(1);
      respond(() => discovery(['v1', 'v2']));
      now += 1;
      // Positive capabilities never trigger an age-based refresh.
      await orca.ensureExtensionAvailable(cloud);
      expect(fetch).toHaveBeenCalledTimes(1);
      fetch.mockImplementation(async (input) =>
        new URL(String(input)).pathname === '/apis'
          ? discovery(['v1', 'v2'])
          : json({ data: [], next_page: null, catalog_id: 'new' }),
      );
      expect((await orca.modelPriceRules.list()).catalog_id).toBe('new');
      expect(fetch.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
        '/apis',
        '/apis',
        '/apis/pricing.runorca.ai/v2/modelpricerules',
      ]);
    },
  );

  it('singleflights concurrent refreshes and measures age from successful completion', async () => {
    const { orca, fetch } = setup();
    await expect(orca.ensureExtensionAvailable(pricing, undefined, 'v2')).rejects.toThrow();
    now += 15000;
    let finish!: (response: Response) => void;
    let refreshStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
          refreshStarted();
        }),
    );
    const results = Promise.allSettled([
      orca.ensureExtensionAvailable(pricing, undefined, 'v2'),
      orca.ensureExtensionAvailable(pricing, undefined, 'v2'),
      orca.ensureExtensionAvailable('runtime.runorca.ai'),
    ]);
    await started;
    now += 5000;
    finish(discovery(['v1']));
    expect((await results).every((result) => result.status === 'rejected')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    now += 14999;
    await expect(orca.ensureExtensionAvailable(pricing, undefined, 'v2')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
    now += 1;
    fetch.mockImplementation(async () => discovery(['v1', 'v2']));
    await orca.ensureExtensionAvailable(pricing, undefined, 'v2');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test.each([503, 404])(
    'keeps last successful snapshot and timestamp after refresh HTTP %s',
    async (status) => {
      const { orca, fetch, respond } = setup();
      await orca.ensureExtensionAvailable(cloud);
      now += 15000;
      respond(() => json({ error: 'unavailable' }, status));
      await expect(orca.ensureExtensionAvailable(pricing, undefined, 'v2')).rejects.toMatchObject({ status });
      await orca.ensureExtensionAvailable(cloud);
      await orca.ensureExtensionAvailable(pricing, undefined, 'v1');
      expect(fetch).toHaveBeenCalledTimes(2);
      respond(() => discovery(['v1', 'v2']));
      // No clock advance: a failed refresh must not defer the next attempt.
      await orca.ensureExtensionAvailable(pricing, undefined, 'v2');
      expect(fetch).toHaveBeenCalledTimes(3);
    },
  );

  it('preserves refresh request controls and caches per effective deployment', async () => {
    const { orca, fetch } = setup();
    const options: RequestOptions = {
      defaultBaseURL: 'https://other.example.test',
      headers: new Headers({ Authorization: 'Bearer other', 'X-Test': 'refresh' }),
      maxRetries: 1,
      timeout: 1234,
      fetchOptions: { redirect: 'error' },
    };
    await expect(orca.ensureExtensionAvailable(pricing, options, 'v2')).rejects.toThrow();
    now += 15000;
    fetch.mockImplementation(async () =>
      fetch.mock.calls.length === 2
        ? new Response('{}', { status: 503, headers: { 'retry-after-ms': '1' } })
        : discovery(['v1', 'v2']),
    );
    const timedFetch = jest.spyOn(orca, 'fetchWithTimeout');
    await orca.ensureExtensionAvailable(pricing, options, 'v2');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(timedFetch.mock.calls.every((call) => call[2] === 1234)).toBe(true);
    for (const [input, init] of fetch.mock.calls) {
      expect(String(input)).toBe('https://other.example.test/apis');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer other');
      expect(new Headers(init?.headers).get('X-Test')).toBe('refresh');
      expect(init?.redirect).toBe('error');
    }
    await orca.ensureExtensionAvailable(pricing, undefined, 'v2');
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(String(fetch.mock.calls[3]![0])).toBe('https://api.example.test/apis');
  });

  it('isolates controlled refresh cancellation from an uncontrolled waiter', async () => {
    const { orca, fetch } = setup();
    await orca.ensureExtensionAvailable(cloud);
    now += 15000;
    const controller = new AbortController();
    let controlledStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      controlledStarted = resolve;
    });
    let finish!: (response: Response) => void;
    let sharedStarted!: () => void;
    const sharing = new Promise<void>((resolve) => {
      sharedStarted = resolve;
    });
    fetch.mockImplementation(async (_input, init) => {
      if (new Headers(init?.headers).has('X-Controlled')) {
        controlledStarted();
        return new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          }),
        );
      }
      return new Promise<Response>((resolve) => {
        finish = resolve;
        sharedStarted();
      });
    });
    const controlled = expect(
      orca.ensureExtensionAvailable(
        pricing,
        {
          signal: controller.signal,
          headers: { 'X-Controlled': 'yes' },
        },
        'v2',
      ),
    ).rejects.toBeInstanceOf(APIUserAbortError);
    const shared = orca.ensureExtensionAvailable(pricing, undefined, 'v2');
    await started;
    await sharing;
    controller.abort();
    await controlled;
    finish(discovery(['v1', 'v2']));
    await shared;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
