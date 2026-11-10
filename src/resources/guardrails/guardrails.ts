// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../core/pagination';
import { APIResource } from '../../core/resource';
import { POLICY_EXTENSION_GROUP } from '../../internal/constants';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { extensionGate } from '../extension-gate';

export type GuardrailPhase =
  | 'request'
  | 'tool_call'
  | 'tool_result'
  | 'response'
  | 'llm_request'
  | 'llm_response';

export type GuardrailScope = 'organization' | 'workspace' | 'explicit';
export type GuardrailVerdict = 'ask' | 'deny';
export type GuardrailStateScope = 'turn' | 'session' | 'subject_window' | 'workspace_window';
export type GuardrailMode = 'enforce' | 'observe';

export interface GuardrailBuiltinRule {
  kind: 'builtin';
  builtin: string;
  params?: Record<string, unknown>;
}

export interface GuardrailExpressionRule {
  kind: 'expression';
  expression: string;
  on_false: GuardrailVerdict;
  reason?: string;
}

export interface GuardrailDogwoodRule {
  kind: 'dogwood';
  policy: string;
  applies_to?: 'all_tools' | 'mcp_tools';
  history?: 'session' | 'principal';
  mcp_manifests?: Array<{ server: string; url: string; tools: Record<string, unknown>[] }>;
}

/** Known request variants; responses can also carry future rule kinds. */
export type GuardrailRule = GuardrailBuiltinRule | GuardrailExpressionRule | GuardrailDogwoodRule;
export interface GuardrailUnknownRule {
  kind: string;
  [key: string]: unknown;
}
export type GuardrailResponseRule = GuardrailRule | GuardrailUnknownRule;

/** Narrow a decoded response without treating malformed known kinds as valid. */
export function isGuardrailBuiltinRule(rule: GuardrailResponseRule): rule is GuardrailBuiltinRule {
  return (
    rule.kind === 'builtin' &&
    typeof rule['builtin'] === 'string' &&
    (rule['params'] === undefined || isRecord(rule['params']))
  );
}

/** Narrow an expression response rule, including its required verdict. */
export function isGuardrailExpressionRule(rule: GuardrailResponseRule): rule is GuardrailExpressionRule {
  return (
    rule.kind === 'expression' &&
    typeof rule['expression'] === 'string' &&
    (rule['on_false'] === 'ask' || rule['on_false'] === 'deny') &&
    (rule['reason'] === undefined || typeof rule['reason'] === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrow a Dogwood response, including optional manifest shapes. */
export function isGuardrailDogwoodRule(rule: GuardrailResponseRule): rule is GuardrailDogwoodRule {
  const manifests = (rule as GuardrailUnknownRule)['mcp_manifests'];
  return (
    rule.kind === 'dogwood' &&
    typeof rule['policy'] === 'string' &&
    (rule['applies_to'] === undefined ||
      rule['applies_to'] === 'all_tools' ||
      rule['applies_to'] === 'mcp_tools') &&
    (rule['history'] === undefined || rule['history'] === 'session' || rule['history'] === 'principal') &&
    (manifests === undefined ||
      (Array.isArray(manifests) &&
        manifests.every(
          (manifest) =>
            isRecord(manifest) &&
            typeof manifest['server'] === 'string' &&
            typeof manifest['url'] === 'string' &&
            Array.isArray(manifest['tools']) &&
            manifest['tools'].every(isRecord),
        )))
  );
}

export interface GuardrailEffectiveParams {
  rule_kinds?: string;
  guardrail_capabilities?: string;
}

export interface EffectiveGuardrail {
  id: string;
  name: string;
  tier: 'session' | 'agent' | 'workspace' | 'organization';
  phases: string[];
  rule?: unknown;
  stateful: boolean;
  mode: GuardrailMode;
  state_scope?: GuardrailStateScope;
  subagent_id?: string;
}

export interface EffectiveGuardrailBundle {
  schema: '1';
  bundle_id: string;
  generation: number;
  scope: { org_id: string; workspace_id: string };
  runtime_config_revision: string;
  issued_at: string;
  expires_at: string;
  seed_verdict: 'allow';
  guardrails: EffectiveGuardrail[];
  omitted_rules: number;
}

export interface GuardrailDogwoodSchema {
  base_schema: string;
  event_schemas: { session: string; principal: string };
  language_version: string;
  core_version: string;
  limits: Record<string, unknown>;
}

export interface Guardrail {
  id: string;
  type: 'guardrail';
  name: string;
  description: string;
  enabled: boolean;
  phases: GuardrailPhase[];
  scope: GuardrailScope;
  rule: GuardrailResponseRule;
  mode?: GuardrailMode;
  warnings?: string[];
  metadata?: Record<string, string>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeletedGuardrail {
  id: string;
  type: 'guardrail_deleted';
}

export interface GuardrailType {
  name: string;
  title: string;
  description: string;
  phases: GuardrailPhase[];
  stateful: boolean;
  stateScope?: GuardrailStateScope;
  verdicts: GuardrailVerdict[];
  /** JSON Schema for the builtin's parameter object. */
  paramsSchema: Record<string, unknown>;
}

export interface GuardrailTypeList {
  data: GuardrailType[];
}

export interface GuardrailCreateParams {
  mode?: GuardrailMode;
  name: string;
  description?: string | null;
  enabled?: boolean;
  phases?: GuardrailPhase[];
  scope?: GuardrailScope;
  rule: GuardrailRule;
  metadata?: Record<string, string>;
}

export interface GuardrailUpdateParams {
  mode?: GuardrailMode;
  name?: string;
  description?: string | null;
  enabled?: boolean;
  phases?: GuardrailPhase[];
  scope?: GuardrailScope;
  rule?: GuardrailRule;
  metadata?: Record<string, string | null>;
}

export interface GuardrailListParams extends PageCursorParams {
  include_archived?: boolean;
}

export class Guardrails extends APIResource {
  /**
   * Exchange the effective policy bundle; 304 resolves to null. Lease headers remain available via withResponse().
   * @example
   * const { data, response } = await orca.guardrails.effective({}, { headers: { 'If-None-Match': etag } }).withResponse();
   */
  effective(
    params: GuardrailEffectiveParams = {},
    options?: RequestOptions,
  ): APIPromise<EffectiveGuardrailBundle | null> {
    return this._client.get(
      '/apis/policy.runorca.ai/v1/effectiveguardrails',
      extensionGate(this._client, POLICY_EXTENSION_GROUP, { query: params, ...options }),
    );
  }

  /**
   * Retrieve the policy language schema and runtime limits.
   * @example
   * const schema = await orca.guardrails.dogwoodSchema();
   */
  dogwoodSchema(options?: RequestOptions): APIPromise<GuardrailDogwoodSchema> {
    return this._client.get(
      '/apis/policy.runorca.ai/v1/policyschemas/dogwood',
      extensionGate(this._client, POLICY_EXTENSION_GROUP, options),
    );
  }

  /**
   * Create a guardrail on a deployment that serves the policy extension.
   *
   * @example
   * ```ts
   * const guardrail = await orca.guardrails.create({
   *   name: 'Protect production',
   *   rule: { kind: 'builtin', builtin: 'block_tools', params: { tools: ['shell'] } },
   * });
   * ```
   */
  create(params: GuardrailCreateParams, options?: RequestOptions): APIPromise<Guardrail> {
    return this._client.post(
      '/apis/policy.runorca.ai/v1/guardrails',
      extensionGate(this._client, POLICY_EXTENSION_GROUP, { body: params, ...options }),
    );
  }

  /**
   * List visible guardrails.
   *
   * @example
   * ```ts
   * for await (const guardrail of orca.guardrails.list()) { ... }
   * ```
   */
  list(
    params: GuardrailListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<Guardrail>, Guardrail> {
    return this._client.getAPIList(
      '/apis/policy.runorca.ai/v1/guardrails',
      PageCursor<Guardrail>,
      extensionGate(this._client, POLICY_EXTENSION_GROUP, { query: params, ...options }),
    );
  }

  /**
   * Retrieve a guardrail by ID.
   *
   * @example
   * ```ts
   * const guardrail = await orca.guardrails.retrieve('grd_example');
   * ```
   */
  retrieve(guardrailId: string, options?: RequestOptions): APIPromise<Guardrail> {
    return this._client.get(
      path`/apis/policy.runorca.ai/v1/guardrails/${guardrailId}`,
      extensionGate(this._client, POLICY_EXTENSION_GROUP, options),
    );
  }

  /**
   * Partially update a guardrail.
   *
   * @example
   * ```ts
   * const guardrail = await orca.guardrails.update('grd_example', { enabled: false });
   * ```
   */
  update(
    guardrailId: string,
    params: GuardrailUpdateParams,
    options?: RequestOptions,
  ): APIPromise<Guardrail> {
    return this._client.post(
      path`/apis/policy.runorca.ai/v1/guardrails/${guardrailId}`,
      extensionGate(this._client, POLICY_EXTENSION_GROUP, { body: params, ...options }),
    );
  }

  /**
   * Archive a guardrail.
   *
   * @example
   * ```ts
   * const guardrail = await orca.guardrails.archive('grd_example');
   * ```
   */
  archive(guardrailId: string, options?: RequestOptions): APIPromise<Guardrail> {
    return this._client.post(
      path`/apis/policy.runorca.ai/v1/guardrails/${guardrailId}/archive`,
      extensionGate(this._client, POLICY_EXTENSION_GROUP, options),
    );
  }

  /**
   * Permanently delete an unreferenced guardrail.
   *
   * @example
   * ```ts
   * const deleted = await orca.guardrails.delete('grd_example');
   * ```
   */
  delete(guardrailId: string, options?: RequestOptions): APIPromise<DeletedGuardrail> {
    return this._client.delete(
      path`/apis/policy.runorca.ai/v1/guardrails/${guardrailId}`,
      extensionGate(this._client, POLICY_EXTENSION_GROUP, options),
    );
  }

  /**
   * List the builtin guardrail catalog and its parameter schemas.
   *
   * @example
   * ```ts
   * const { data: types } = await orca.guardrails.listTypes();
   * ```
   */
  listTypes(options?: RequestOptions): APIPromise<GuardrailTypeList> {
    return this._client.get(
      '/apis/policy.runorca.ai/v1/guardrailtypes',
      extensionGate(this._client, POLICY_EXTENSION_GROUP, options),
    );
  }
}
