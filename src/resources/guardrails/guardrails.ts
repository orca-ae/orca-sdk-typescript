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
export type GuardrailStateScope = 'turn' | 'session' | 'subject_window';

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

export type GuardrailRule = GuardrailBuiltinRule | GuardrailExpressionRule;

export interface Guardrail {
  id: string;
  type: 'guardrail';
  name: string;
  description: string;
  enabled: boolean;
  phases: GuardrailPhase[];
  scope: GuardrailScope;
  rule: GuardrailRule;
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
  name: string;
  description?: string | null;
  enabled?: boolean;
  phases?: GuardrailPhase[];
  scope?: GuardrailScope;
  rule: GuardrailRule;
  metadata?: Record<string, string>;
}

export interface GuardrailUpdateParams {
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
