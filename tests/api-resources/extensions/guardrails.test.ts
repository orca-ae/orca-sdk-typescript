// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { ExtensionNotAvailableError } from '../../../src/core/error';
import { POLICY_EXTENSION_GROUP } from '../../../src/internal/constants';
import { PageCursor } from '../../../src/core/pagination';
import type { Orca } from '../../../src/client';
import type { Guardrail, GuardrailType } from '../../../src/resources/guardrails';
import { jsonResponse, makeExtensionClient, makeUnavailableExtensionClient } from './helpers';

const GUARDRAIL: Guardrail = {
  id: 'grd_example',
  type: 'guardrail',
  name: 'Protect production',
  description: 'Blocks risky shell commands',
  enabled: true,
  phases: ['tool_call'],
  scope: 'workspace',
  rule: { kind: 'builtin', builtin: 'block_tools', params: { tools: ['shell'] } },
  metadata: { owner: 'platform' },
  archived_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const GUARDRAIL_TYPE: GuardrailType = {
  name: 'block_tools',
  title: 'Block dangerous shell commands',
  description: 'Blocks risky shell commands.',
  phases: ['tool_call'],
  stateful: false,
  verdicts: ['deny'],
  paramsSchema: { type: 'object' },
};

function responseForGuardrailRequest(url: string, init: RequestInit | undefined): Response {
  const pathname = new URL(url).pathname;
  const method = (init?.method ?? 'GET').toUpperCase();
  if (pathname.endsWith('/guardrailtypes')) return jsonResponse({ data: [GUARDRAIL_TYPE] });
  if (method === 'DELETE') {
    return jsonResponse({ id: GUARDRAIL.id, type: 'guardrail_deleted' });
  }
  if (pathname.endsWith('/guardrails') && method === 'GET') {
    return jsonResponse({ data: [GUARDRAIL], next_page: null });
  }
  return jsonResponse(GUARDRAIL, method === 'POST' && pathname.endsWith('/guardrails') ? 201 : 200);
}

async function makeClient() {
  return makeExtensionClient(POLICY_EXTENSION_GROUP, responseForGuardrailRequest);
}

describe('Guardrails extension', () => {
  it('creates a guardrail with the complete authored wire shape', async () => {
    const { orca, calls } = await makeClient();
    const result = await orca.guardrails.create({
      name: 'Protect production',
      description: null,
      enabled: true,
      phases: ['tool_call'],
      scope: 'explicit',
      rule: {
        kind: 'expression',
        expression: 'event.tool.name != "shell"',
        on_false: 'ask',
        reason: 'Approval required',
      },
      metadata: { owner: 'platform' },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.example.test/apis/policy.runorca.ai/v1/guardrails');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      name: 'Protect production',
      description: null,
      enabled: true,
      phases: ['tool_call'],
      scope: 'explicit',
      rule: {
        kind: 'expression',
        expression: 'event.tool.name != "shell"',
        on_false: 'ask',
        reason: 'Approval required',
      },
      metadata: { owner: 'platform' },
    });
    expect(result).toEqual(GUARDRAIL);
  });

  it('lists guardrails with pagination and archive filtering', async () => {
    const { orca, calls } = await makeClient();
    const page = await orca.guardrails.list({ limit: 25, page: 'next', include_archived: true });

    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toEqual([GUARDRAIL]);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/apis/policy.runorca.ai/v1/guardrails');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('page')).toBe('next');
    expect(url.searchParams.get('include_archived')).toBe('true');
  });

  it('retrieves a guardrail and URL-encodes its ID', async () => {
    const { orca, calls } = await makeClient();
    await expect(orca.guardrails.retrieve('grd/with slash')).resolves.toEqual(GUARDRAIL);
    expect(calls[0]!.url).toBe(
      'https://api.example.test/apis/policy.runorca.ai/v1/guardrails/grd%2Fwith%20slash',
    );
  });

  it('updates a guardrail with POST and metadata patch semantics', async () => {
    const { orca, calls } = await makeClient();
    await orca.guardrails.update('grd_example', {
      enabled: false,
      metadata: { owner: null },
    });

    expect(calls[0]!.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      enabled: false,
      metadata: { owner: null },
    });
  });

  it('archives a guardrail on the archive sub-path', async () => {
    const { orca, calls } = await makeClient();
    await orca.guardrails.archive('grd_example');
    expect(calls[0]!.url).toBe(
      'https://api.example.test/apis/policy.runorca.ai/v1/guardrails/grd_example/archive',
    );
    expect(calls[0]!.init?.method).toBe('POST');
  });

  it('deletes a guardrail and returns its tombstone', async () => {
    const { orca, calls } = await makeClient();
    const deleted = await orca.guardrails.delete('grd_example');
    expect(calls[0]!.init?.method).toBe('DELETE');
    expect(deleted).toEqual({ id: 'grd_example', type: 'guardrail_deleted' });
  });

  it('lists builtin guardrail types and parameter schemas', async () => {
    const { orca, calls } = await makeClient();
    const result = await orca.guardrails.listTypes();
    expect(calls[0]!.url).toBe('https://api.example.test/apis/policy.runorca.ai/v1/guardrailtypes');
    expect(result.data).toEqual([GUARDRAIL_TYPE]);
  });

  const callsWithOptions: Array<[string, (orca: Orca) => PromiseLike<unknown>]> = [
    [
      'create',
      (orca) =>
        orca.guardrails.create(
          { name: 'Rule', rule: { kind: 'builtin', builtin: 'rule' } },
          { headers: { 'X-Test': 'create' } },
        ),
    ],
    ['list', (orca) => orca.guardrails.list({}, { headers: { 'X-Test': 'list' } })],
    ['retrieve', (orca) => orca.guardrails.retrieve('grd_example', { headers: { 'X-Test': 'retrieve' } })],
    [
      'update',
      (orca) =>
        orca.guardrails.update('grd_example', { enabled: false }, { headers: { 'X-Test': 'update' } }),
    ],
    ['archive', (orca) => orca.guardrails.archive('grd_example', { headers: { 'X-Test': 'archive' } })],
    ['delete', (orca) => orca.guardrails.delete('grd_example', { headers: { 'X-Test': 'delete' } })],
    ['listTypes', (orca) => orca.guardrails.listTypes({ headers: { 'X-Test': 'listTypes' } })],
  ];

  test.each(callsWithOptions)('%s passes RequestOptions through', async (name, invoke) => {
    const { orca, calls } = await makeClient();
    await invoke(orca);
    expect((calls[0]!.init?.headers as Headers).get('X-Test')).toBe(name);
  });

  test.each(callsWithOptions)(
    '%s fails before the business request when policy is unavailable',
    async (_name, invoke) => {
      const { orca, calls } = makeUnavailableExtensionClient();
      await expect(invoke(orca)).rejects.toBeInstanceOf(ExtensionNotAvailableError);
      expect(calls.map((call) => call.url)).toEqual(['https://api.example.test/apis']);
    },
  );
});
