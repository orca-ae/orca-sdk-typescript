// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIPromise } from '../../src/core/api-promise';
import type { APIResponseProps } from '../../src/internal/parse';

/** Build a fake APIResponseProps from a plain object body. */
function makeProps(body: unknown, status = 200): APIResponseProps {
  const json = JSON.stringify(body);
  const response = new Response(json, {
    status,
    headers: { 'content-type': 'application/json', 'request-id': 'req_test' },
  });
  return {
    response,
    options: { method: 'get', path: '/test' },
    controller: new AbortController(),
    requestLogID: 'log_test',
    retryOfRequestLogID: undefined,
    startTime: Date.now(),
  };
}

/** Simple parser that JSON-parses the response body. */
async function jsonParser(props: APIResponseProps): Promise<unknown> {
  return props.response.json();
}

function makePromise<T>(body: T, status = 200): APIPromise<T> {
  const props = makeProps(body, status);
  return new APIPromise<T>(
    Promise.resolve(props),
    jsonParser as (props: APIResponseProps) => Promise<T>,
  );
}

describe('APIPromise', () => {
  it('.asResponse() resolves to the Response', async () => {
    const p = makePromise({ id: 1 });
    const res = await p.asResponse();
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
  });

  it('.withResponse() resolves to { data, response }', async () => {
    const p = makePromise({ id: 42 });
    const { data, response } = await p.withResponse();
    expect(data).toEqual({ id: 42 });
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('request-id')).toBe('req_test');
  });

  it('.then() chains with the parsed data', async () => {
    const p = makePromise({ name: 'agent-1' });
    const name = await p.then((d) => (d as any).name);
    expect(name).toBe('agent-1');
  });

  it('.catch() propagates to rejection handler', async () => {
    const failing = new APIPromise<never>(
      Promise.reject(new Error('network error')),
      jsonParser as any,
    );
    const caught = await failing.catch((e) => e.message);
    expect(caught).toBe('network error');
  });

  it('.finally() runs after resolution', async () => {
    const p = makePromise({ ok: true });
    let ran = false;
    await p.finally(() => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('parse() is only called once (memoized)', async () => {
    let calls = 0;
    const props = makeProps({ x: 1 });
    const p = new APIPromise(Promise.resolve(props), async (pr) => {
      calls++;
      return pr.response.json();
    });
    await p;
    await p;
    expect(calls).toBe(1);
  });
});
