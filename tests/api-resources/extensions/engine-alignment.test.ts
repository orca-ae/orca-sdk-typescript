// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { Orca } from '../../../src/client';
import { ExtensionNotAvailableError } from '../../../src/core/error';
import {
  ModelPriceRulePage,
  isGuardrailDogwoodRule,
  isGuardrailBuiltinRule,
  isGuardrailExpressionRule,
} from '../../../src';
import type {
  GuardrailCreateParams,
  GuardrailMode,
  GuardrailResponseRule,
  GuardrailStateScope,
  APIResourceList,
  ModelPriceRuleCatalog,
} from '../../../src';
import { jsonResponse } from './helpers';

function clientFor(respond: (url: URL, init: RequestInit | undefined) => Response, versions = ['v1', 'v2']) {
  const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const orca = new Orca({
    apiKey: 'key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      if (url.pathname === '/apis')
        return jsonResponse({
          kind: 'APIGroupList',
          groups: ['policy.runorca.ai', 'pricing.runorca.ai', 'runtime.runorca.ai'].map((name) => ({
            name,
            versions: versions.map((version) => ({ version, group_version: name + '/' + version })),
            preferred_version: { version: 'v1', group_version: name + '/v1' },
          })),
        });
      return respond(url, init);
    },
  });
  return { orca, calls };
}

const dogwood: GuardrailCreateParams = {
  name: 'policy',
  mode: 'observe',
  scope: 'workspace',
  rule: {
    kind: 'dogwood',
    policy: 'permit(principal, action, resource);',
    applies_to: 'mcp_tools',
    history: 'principal',
    mcp_manifests: [{ server: 'tools', url: 'https://tools.example', tools: [{ name: 'read' }] }],
  },
};

type Assert<T extends true> = T;
type _Mode = Assert<'audit' extends GuardrailMode ? false : true>;
type _WorkspaceScope = Assert<'workspace_window' extends GuardrailStateScope ? true : false>;
type _ClosedRule = Assert<{ kind: 'future' } extends GuardrailCreateParams['rule'] ? false : true>;
type _RequiredPolicy = Assert<{ kind: 'dogwood' } extends GuardrailCreateParams['rule'] ? false : true>;
type _Features = Assert<string[] extends NonNullable<APIResourceList['required_features']> ? true : false>;

const metadata: ModelPriceRuleCatalog = {
  catalog_id: 'snapshot',
  generation: 7,
  digest: 'digest',
  published_at: '2026-11-09T00:00:00Z',
  expires_at: '2026-11-09T01:00:00Z',
  required_features: ['future-feature'],
  conditional_models: [{ provider: 'p', model_id: 'm' }],
};

describe('engine alignment', () => {
  it('roundtrips Dogwood and preserves unknown response rules and warnings', async () => {
    const { orca, calls } = clientFor((_url, init) =>
      jsonResponse({ ...JSON.parse(String(init?.body)), warnings: ['observe only'] }, 201),
    );
    const result = await orca.guardrails.create(dogwood, { headers: { 'X-Test': 'dogwood' } });
    expect(result.rule).toEqual(dogwood.rule);
    expect(result.mode).toBe('observe');
    expect(result.warnings).toEqual(['observe only']);
    expect(isGuardrailDogwoodRule(result.rule)).toBe(true);
    expect(new Headers(calls[1]!.init?.headers).get('X-Test')).toBe('dogwood');
    expect(new Headers(calls[1]!.init?.headers).get('content-type')).toBe('application/json');
    const unknown = { kind: 'future', nested: { untouched: [1, 2] } };
    const future = clientFor(() => jsonResponse({ rule: unknown }));
    expect((await future.orca.guardrails.retrieve('grd/id')).rule).toEqual(unknown);
    expect(future.calls[1]!.url.pathname).toBe('/apis/policy.runorca.ai/v1/guardrails/grd%2Fid');
    expect(isGuardrailDogwoodRule(unknown)).toBe(false);
  });

  test.each<GuardrailResponseRule>([
    { kind: 'dogwood', policy: 1 },
    { kind: 'dogwood', policy: 'x', history: 'invalid' },
    { kind: 'dogwood', policy: 'x', mcp_manifests: [{}] },
    { kind: 'builtin', builtin: 1 },
    { kind: 'expression', expression: 'x', on_false: 'allow' },
  ])('typeguards reject malformed known response shape %j', (rule) => {
    expect(
      isGuardrailDogwoodRule(rule) || isGuardrailBuiltinRule(rule) || isGuardrailExpressionRule(rule),
    ).toBe(false);
  });

  test.each([200, 304])('effective %s preserves lease headers through withResponse', async (status) => {
    const bundle = {
      schema: '1',
      bundle_id: 'bundle',
      generation: 1,
      scope: { org_id: 'o', workspace_id: 'w' },
      runtime_config_revision: 'rev',
      issued_at: '2026-11-09T00:00:00Z',
      expires_at: '2026-11-09T01:00:00Z',
      seed_verdict: 'allow',
      guardrails: [],
      omitted_rules: 0,
    };
    const headers = {
      ETag: '"registry-' + 'a'.repeat(64) + '"',
      'Cache-Control': 'no-store',
      'Orca-Guardrail-Issued-At': bundle.issued_at,
      'Orca-Guardrail-Expires-At': bundle.expires_at,
      'Orca-Guardrail-Generation': '1',
      'content-type': 'application/json',
    };
    const json = jest.fn(() => {
      throw new Error('304 must not parse JSON');
    });
    const { orca, calls } = clientFor(() => {
      const response = new Response(status === 304 ? null : JSON.stringify(bundle), { status, headers });
      if (status === 304) Object.defineProperty(response, 'json', { value: json });
      return response;
    });
    const { data, response } = await orca.guardrails
      .effective(
        { rule_kinds: 'builtin,dogwood', guardrail_capabilities: 'future' },
        { headers: { 'If-None-Match': '"old"', 'X-Test': 'lease' }, timeout: 1000 },
      )
      .withResponse();
    expect(data).toEqual(status === 304 ? null : bundle);
    for (const [name, value] of Object.entries(headers)) expect(response.headers.get(name)).toBe(value);
    expect(json).not.toHaveBeenCalled();
    expect(calls[1]!.url.pathname).toBe('/apis/policy.runorca.ai/v1/effectiveguardrails');
    expect(calls[1]!.url.searchParams.get('rule_kinds')).toBe('builtin,dogwood');
    expect(calls[1]!.url.searchParams.get('guardrail_capabilities')).toBe('future');
    expect(new Headers(calls[1]!.init?.headers).get('If-None-Match')).toBe('"old"');
    expect(new Headers(calls[1]!.init?.headers).get('Authorization')).toBe('Bearer key');
  });

  test.each([302, 304])('other endpoints continue rejecting HTTP %s', async (status) => {
    const { orca } = clientFor(() => new Response(null, { status }));
    await expect(orca.guardrails.listTypes()).rejects.toMatchObject({ status });
  });

  it('retains pricing metadata and specialized class on every next page and auto-iteration', async () => {
    const { orca, calls } = clientFor((url) =>
      jsonResponse({
        ...metadata,
        data: [{ rule_id: url.searchParams.get('page') ?? 'first' }],
        next_page: url.searchParams.has('page') ? null : 'cursor',
      }),
    );
    const options = { headers: { 'X-Test': 'snapshot' }, timeout: 1000 };
    const page = await orca.modelPriceRules.list({ limit: 1 }, options);
    const next = await page.getNextPage();
    expect(next).toBeInstanceOf(ModelPriceRulePage);
    for (const result of [page, next])
      for (const [key, value] of Object.entries(metadata)) {
        expect((result as unknown as Record<string, unknown>)[key]).toEqual(value);
      }
    expect(calls[2]!.url.searchParams.get('page')).toBe('cursor');
    expect(calls[2]!.url.searchParams.get('limit')).toBe('1');
    expect(new Headers(calls[2]!.init?.headers).get('X-Test')).toBe('snapshot');
    const construct = jest.spyOn(orca, 'requestAPIList');
    const ids: string[] = [];
    for await (const rule of orca.modelPriceRules.list({ limit: 1 }, options)) ids.push(rule.rule_id);
    expect(ids).toEqual(['first', 'cursor']);
    expect(construct.mock.calls.every((call) => call[0] === ModelPriceRulePage)).toBe(true);
  });

  it('stops an expired pricing snapshot with 410 without restart', async () => {
    const { orca, calls } = clientFor((url) =>
      url.searchParams.has('page')
        ? jsonResponse({ error: 'expired' }, 410)
        : jsonResponse({ ...metadata, data: [{ rule_id: 'one' }], next_page: 'expired' }),
    );
    const seen: string[] = [];
    await expect(
      (async () => {
        for await (const rule of orca.modelPriceRules.list()) seen.push(rule.rule_id);
      })(),
    ).rejects.toMatchObject({ status: 410 });
    expect(seen).toEqual(['one']);
    expect(calls).toHaveLength(3);
  });

  test.each(['v1', 'missing'])('rejects v2 when only %s is advertised', async (version) => {
    const { orca, calls } = clientFor(() => jsonResponse({}), version === 'v1' ? ['v1'] : []);
    await expect(orca.modelPriceRules.list()).rejects.toBeInstanceOf(ExtensionNotAvailableError);
    await expect(orca.discovery.pricingV2GroupResources()).rejects.toBeInstanceOf(ExtensionNotAvailableError);
    expect(calls).toHaveLength(1);
  });

  const operations: Array<[string, string, (orca: Orca) => PromiseLike<unknown>]> = [
    [
      '/apis/policy.runorca.ai/v1/policyschemas/dogwood',
      'GET',
      (c) => c.guardrails.dogwoodSchema({ headers: { 'X-Test': 'options' } }),
    ],
    [
      '/apis/pricing.runorca.ai/v2',
      'GET',
      (c) => c.discovery.pricingV2GroupResources({ headers: { 'X-Test': 'options' } }),
    ],
    [
      '/apis/runtime.runorca.ai/v1',
      'GET',
      (c) => c.discovery.runtimeGroupResources({ headers: { 'X-Test': 'options' } }),
    ],
    [
      '/apis/runtime.runorca.ai/v1/harnesses',
      'GET',
      (c) => c.discovery.harnesses({ headers: { 'X-Test': 'options' } }),
    ],
    [
      '/v1/environments/env%2Fid/rotate-key',
      'POST',
      (c) =>
        c.environments.rotateKey('env/id', { headers: { 'X-Test': 'options' }, idempotencyKey: 'rotate' }),
    ],
    [
      '/v1/environments/env%2Fid/revoke-key',
      'POST',
      (c) => c.environments.revokeKey('env/id', { headers: { 'X-Test': 'options' } }),
    ],
    [
      '/v1/environments/env%2Fid/work_stats',
      'GET',
      (c) => c.environments.workStats('env/id', { headers: { 'X-Test': 'options' } }),
    ],
    [
      '/v1/sessions/ses%2Fid/threads/sth%2Fid/interrupt',
      'POST',
      (c) => c.sessions.threads.interrupt('ses/id', 'sth/id', { headers: { 'X-Test': 'options' } }),
    ],
  ];
  test.each(operations)(
    '%s uses its literal method/path and passes options',
    async (literal, method, invoke) => {
      const body = { required_features: ['unknown-feature'] };
      const { orca, calls } = clientFor(() => jsonResponse(body));
      expect(await invoke(orca)).toEqual(body);
      const call = calls[calls.length - 1]!;
      expect(call.url.pathname).toBe(literal);
      expect(call.init?.method).toBe(method);
      if (method === 'POST') {
        expect(JSON.parse(String(call.init?.body))).toEqual({});
        expect(new Headers(call.init?.headers).get('content-type')).toBe('application/json');
      } else {
        expect(call.init?.body).toBeUndefined();
      }
      expect(new Headers(call.init?.headers).get('X-Test')).toBe('options');
      if (literal.endsWith('rotate-key'))
        expect(new Headers(call.init?.headers).get('idempotency-key')).toBe('rotate');
    },
  );
});
