// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../src/client';

const result = { env_key: 'fixture', env_key_expires_at: '2026-11-10T00:00:00Z' };
const json = (status: number) =>
  new Response(JSON.stringify(result), {
    status,
    headers: { 'content-type': 'application/json', 'retry-after-ms': '1' },
  });

describe('environment key rotation retries', () => {
  test.each(['default', 'global'] as const)(
    '%s retry settings do not retry rotation failures',
    async (setting) => {
      for (const transportFailure of [false, true]) {
        let attempts = 0;
        const fetch = jest.fn(async () => {
          if (++attempts === 1) {
            if (transportFailure) throw new Error('fixture connection lost');
            return json(504);
          }
          return json(200);
        });
        const client = new Orca({
          apiKey: 'fixture',
          baseURL: 'https://api.example.test',
          fetch,
          ...(setting === 'global' ? { maxRetries: 4 } : {}),
        });
        await expect(client.environments.rotateKey('env_a')).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('keeps undefined per-call retries at the safe default', async () => {
    const fetch = jest.fn(async () => json(504));
    const client = new Orca({ apiKey: 'fixture', baseURL: 'https://api.example.test', maxRetries: 2, fetch });
    // @ts-expect-error Exercise JavaScript callers passing an explicit undefined property.
    await expect(client.environments.rotateKey('env_a', { maxRetries: undefined })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves success, request options and explicit retry opt-in', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = new Orca({
      apiKey: 'fixture',
      baseURL: 'https://api.example.test',
      fetch: async (input, init) => {
        calls.push({ url: String(input), init });
        return json(calls.length === 1 ? 504 : 200);
      },
    });
    expect(
      await client.environments.rotateKey('env/a', {
        maxRetries: 1,
        idempotencyKey: 'explicit',
        headers: { 'X-Test': 'rotation' },
        timeout: 1000,
      }),
    ).toEqual(result);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(new URL(call.url).pathname).toBe('/v1/environments/env%2Fa/rotate-key');
      expect(call.init?.method).toBe('POST');
      expect(JSON.parse(String(call.init?.body))).toEqual({});
      const headers = new Headers(call.init?.headers);
      expect(headers.get('idempotency-key')).toBe('explicit');
      expect(headers.get('X-Test')).toBe('rotation');
      expect(headers.get('Authorization')).toBe('Bearer fixture');
    }
  });

  it('retains default retries on ordinary reads', async () => {
    let attempts = 0;
    const fetch = jest.fn(async () => json(++attempts <= 2 ? 504 : 200));
    const client = new Orca({ apiKey: 'fixture', baseURL: 'https://api.example.test', fetch });
    await expect(client.environments.rotateKey('env_a')).rejects.toThrow();
    await client.environments.retrieve('env_a');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
