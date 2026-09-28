// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../../src/client';
import type { OrcaOptions } from '../../../src/client';
import { PageCursor } from '../../../src/core/pagination';
import type { Fetch, RequestInfo } from '../../../src/internal/builtin-types';
import type { Session, SessionAgent } from '../../../src/resources/sessions';
import type { Trigger, TriggerCreateParams } from '../../../src/resources/triggers';

const TRIGGER_FIXTURE: Trigger = {
  id: 'trg_abc123',
  type: 'trigger',
  name: 'daily-summary',
  agent: { type: 'agent', id: 'agt_abc123', version: 2 },
  session_mode: 'SESSION_PER_EVENT',
  source: {
    type: 'cron',
    schedule: '0 9 * * *',
    timezone: 'Etc/UTC',
    payload: 'Summarize yesterday.',
  },
  session: {
    environment_id: 'env_abc123',
    title_template: null,
    metadata: { suite: 'unit' },
    vault_ids: [],
  },
  replicas: 1,
  status: 'active',
  next_fire_at: '2026-08-21T01:00:00Z',
  last_fired_at: null,
  error: null,
  archived_at: null,
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
};

const SESSION_AGENT_FIXTURE: SessionAgent = {
  id: 'agt_abc123',
  type: 'agent',
  name: 'Summary agent',
  description: null,
  version: 2,
  model: { id: 'claude-sonnet-4-6' },
  system: null,
  tools: [],
  mcp_servers: [],
  skills: [],
  multiagent: null,
};

const SESSION_FIXTURE: Session = {
  id: 'ses_abc123',
  type: 'session',
  agent: SESSION_AGENT_FIXTURE,
  environment_id: 'env_abc123',
  vault_ids: [],
  status: 'idle',
  title: 'Trigger session',
  stats: {},
  outcome_evaluations: [],
  usage: {},
  resources: [],
  metadata: {},
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
  archived_at: null,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

type CapturedCall = { url: string; init: RequestInit | undefined };

function makeClient(
  fakeFetch?: Fetch,
  opts: Partial<OrcaOptions> = {},
): { orca: Orca; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const capturingFetch: Fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });
    if (fakeFetch) return fakeFetch(input, init);
    if (url.includes('/sessions')) {
      return jsonResponse({ data: [SESSION_FIXTURE], next_page: null });
    }
    if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
      return jsonResponse({ id: TRIGGER_FIXTURE.id, type: 'trigger_deleted' });
    }
    if (new URL(url).pathname === '/v1/triggers' && (init?.method ?? 'GET') === 'GET') {
      return jsonResponse({ data: [TRIGGER_FIXTURE], next_page: null });
    }
    return jsonResponse(TRIGGER_FIXTURE);
  };

  return {
    orca: new Orca({
      apiKey: 'test-key',
      baseURL: 'https://api.example.test',
      fetch: capturingFetch,
      maxRetries: 0,
      ...opts,
    }),
    calls,
  };
}

function expectCustomHeader(call: CapturedCall, value: string): void {
  expect((call.init?.headers as Headers).get('X-Test-Header')).toBe(value);
}

describe('Orca.triggers', () => {
  it('mounts the core Trigger resource and its Sessions sub-resource', () => {
    const { orca } = makeClient();
    expect(orca.triggers).toBeDefined();
    expect(orca.triggers.sessions).toBeDefined();
    expect('triggers' in orca.cloud).toBe(false);
  });
});

describe('Triggers.create()', () => {
  it('sends managed-deployment Kafka fields to POST /v1/triggers unchanged', async () => {
    const { orca, calls } = makeClient();
    await orca.triggers.create(
      {
        name: 'orders',
        agent: { type: 'agent', id: 'agt_abc123', version: 2 },
        session_mode: 'SESSION_PER_KEY',
        source: {
          type: 'kafka',
          connection: 'orders',
          topics: ['orders.created'],
          subscription_name: 'orca-sdk',
          consumer_additional_config: { 'auto.offset.reset': 'earliest' },
          input_schema_configs: {
            value: { subject: 'orders-value', type: 'AVRO', version: 1 },
          },
        },
        session: { environment_id: 'env_abc123', vault_ids: [] },
        replicas: 3,
      },
      { headers: { 'X-Test-Header': 'create' } },
    );

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe('/v1/triggers');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toMatchObject({
      session_mode: 'SESSION_PER_KEY',
      source: {
        type: 'kafka',
        connection: 'orders',
        topics: ['orders.created'],
        consumer_additional_config: { 'auto.offset.reset': 'earliest' },
      },
      replicas: 3,
    });
    expectCustomHeader(calls[0]!, 'create');
  });

  it('types messaging selectors and cron session-mode combinations from the overlay', () => {
    const invalidKafka: TriggerCreateParams = {
      name: 'invalid-kafka',
      agent: 'agt_abc123',
      session_mode: 'SESSION_PER_EVENT',
      // @ts-expect-error Kafka requires exactly one of topics or topic_pattern.
      source: { type: 'kafka', connection: 'orders' },
      session: { environment_id: 'env_abc123' },
    };
    // @ts-expect-error Cron does not support per-topic sessions.
    const invalidCron: TriggerCreateParams = {
      name: 'invalid-cron',
      agent: 'agt_abc123',
      session_mode: 'SESSION_PER_TOPIC',
      source: { type: 'cron', schedule: '* * * * *', payload: 'run' },
      session: { environment_id: 'env_abc123' },
    };

    expect(invalidKafka.source.type).toBe('kafka');
    expect(invalidCron.source.type).toBe('cron');
  });
});

describe('Triggers.list()', () => {
  it('returns a PageCursor and forwards the portable filter and RequestOptions', async () => {
    const { orca, calls } = makeClient();
    const page = await orca.triggers.list(
      { agent_id: 'agt_abc123', limit: 10, page: 'next-token' },
      { headers: { 'X-Test-Header': 'list' } },
    );

    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toEqual([TRIGGER_FIXTURE]);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/triggers');
    expect(url.searchParams.get('agent_id')).toBe('agt_abc123');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('page')).toBe('next-token');
    expectCustomHeader(calls[0]!, 'list');
  });
});

describe('Triggers.retrieve()', () => {
  it('escapes the Trigger ID and forwards RequestOptions', async () => {
    const { orca, calls } = makeClient();
    await orca.triggers.retrieve('trigger/with/slash', {
      headers: { 'X-Test-Header': 'retrieve' },
    });

    expect(new URL(calls[0]!.url).pathname).toBe('/v1/triggers/trigger%2Fwith%2Fslash');
    expectCustomHeader(calls[0]!, 'retrieve');
  });
});

describe('Triggers.update()', () => {
  it('uses POST and preserves managed-deployment Pulsar fields', async () => {
    const { orca, calls } = makeClient();
    await orca.triggers.update(
      'trg_abc123',
      {
        session_mode: 'SHARED',
        source: {
          type: 'pulsar',
          connection: 'events',
          topic_pattern: 'persistent://public/default/orders-.*',
        },
        session: { metadata: { keep: 'yes', remove: null } },
        replicas: 2,
      },
      { headers: { 'X-Test-Header': 'update' } },
    );

    expect(new URL(calls[0]!.url).pathname).toBe('/v1/triggers/trg_abc123');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      session_mode: 'SHARED',
      source: {
        type: 'pulsar',
        connection: 'events',
        topic_pattern: 'persistent://public/default/orders-.*',
      },
      session: { metadata: { keep: 'yes', remove: null } },
      replicas: 2,
    });
    expectCustomHeader(calls[0]!, 'update');
  });
});

describe('Triggers.delete()', () => {
  it('uses DELETE and returns a typed tombstone', async () => {
    const { orca, calls } = makeClient();
    const deleted = await orca.triggers.delete('trg_abc123', {
      headers: { 'X-Test-Header': 'delete' },
    });

    expect(calls[0]!.init?.method).toBe('DELETE');
    expect(deleted).toEqual({ id: 'trg_abc123', type: 'trigger_deleted' });
    expectCustomHeader(calls[0]!, 'delete');
  });
});

describe('Trigger actions', () => {
  it('pauses through the /pause sub-path and forwards RequestOptions', async () => {
    const { orca, calls } = makeClient();
    await orca.triggers.pause('trg_abc123', { headers: { 'X-Test-Header': 'pause' } });

    expect(new URL(calls[0]!.url).pathname).toBe('/v1/triggers/trg_abc123/pause');
    expect(calls[0]!.init?.method).toBe('POST');
    expectCustomHeader(calls[0]!, 'pause');
  });

  it('unpauses through the /unpause sub-path and forwards RequestOptions', async () => {
    const { orca, calls } = makeClient();
    await orca.triggers.unpause('trg_abc123', {
      headers: { 'X-Test-Header': 'unpause' },
    });

    expect(new URL(calls[0]!.url).pathname).toBe('/v1/triggers/trg_abc123/unpause');
    expect(calls[0]!.init?.method).toBe('POST');
    expectCustomHeader(calls[0]!, 'unpause');
  });
});

describe('Trigger sessions', () => {
  it('returns core Session entities and forwards list params and RequestOptions', async () => {
    const { orca, calls } = makeClient();
    const page = await orca.triggers.sessions.list(
      'trigger/with/slash',
      { limit: 5, page: 'session-page', include_archived: true },
      { headers: { 'X-Test-Header': 'sessions' } },
    );

    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data[0]).toEqual(SESSION_FIXTURE);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/triggers/trigger%2Fwith%2Fslash/sessions');
    expect(url.searchParams.get('include_archived')).toBe('true');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('page')).toBe('session-page');
    expectCustomHeader(calls[0]!, 'sessions');
  });
});
