// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../../src/client';

const thread = { id: 'sth_a', type: 'session_thread', status: 'terminated' };
const json = (status: number) =>
  new Response(JSON.stringify(thread), {
    status,
    headers: { 'content-type': 'application/json', 'retry-after-ms': '1' },
  });

describe('thread interrupt retries', () => {
  test.each(['default', 'global'] as const)(
    '%s settings do not retry HTTP or transport failures',
    async (setting) => {
      for (const transportFailure of [false, true]) {
        const fetch = jest.fn(async () => {
          if (fetch.mock.calls.length === 1) {
            if (transportFailure) throw new Error('connection lost after append');
            return json(502);
          }
          return json(200);
        });
        const orca = new Orca({
          apiKey: 'key',
          baseURL: 'https://api.example.test',
          fetch,
          ...(setting === 'global' ? { maxRetries: 4 } : {}),
        });
        await expect(orca.sessions.threads.interrupt('ses_a', 'sth_a')).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('treats explicit undefined retries as zero', async () => {
    const fetch = jest.fn(async () => json(502));
    const orca = new Orca({ apiKey: 'key', baseURL: 'https://api.example.test', maxRetries: 4, fetch });
    await expect(
      // @ts-expect-error Exercise JavaScript callers passing an explicit undefined property.
      orca.sessions.threads.interrupt('ses_a', 'sth_a', { maxRetries: undefined }),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each([0, 1])('preserves success and options with per-call maxRetries=%s', async (maxRetries) => {
    const fetch = jest.fn(async (_input: unknown, _init?: RequestInit): Promise<Response> =>
      json(maxRetries === 1 && fetch.mock.calls.length === 1 ? 502 : 200),
    );
    const orca = new Orca({ apiKey: 'key', baseURL: 'https://api.example.test', fetch });
    const timedFetch = jest.spyOn(orca, 'fetchWithTimeout');
    await expect(
      orca.sessions.threads.interrupt('ses/a', 'sth/a', {
        maxRetries,
        headers: { 'X-Test': 'interrupt', Authorization: 'Bearer override' },
        timeout: 1234,
      }),
    ).resolves.toEqual(thread);
    expect(fetch).toHaveBeenCalledTimes(maxRetries + 1);
    expect(timedFetch.mock.calls.every((call) => call[2] === 1234)).toBe(true);
    for (const [input, init] of fetch.mock.calls) {
      expect(new URL(String(input)).pathname).toBe('/v1/sessions/ses%2Fa/threads/sth%2Fa/interrupt');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({});
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Test')).toBe('interrupt');
      expect(headers.get('Authorization')).toBe('Bearer override');
    }
  });

  it('keeps ordinary reads on the same client retrying', async () => {
    let attempts = 0;
    const fetch = jest.fn(async () => json(++attempts <= 2 ? 502 : 200));
    const orca = new Orca({ apiKey: 'key', baseURL: 'https://api.example.test', fetch });
    await expect(orca.sessions.threads.interrupt('ses_a', 'sth_a')).rejects.toThrow();
    await expect(orca.sessions.threads.retrieve('ses_a', 'sth_a')).resolves.toEqual(thread);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
