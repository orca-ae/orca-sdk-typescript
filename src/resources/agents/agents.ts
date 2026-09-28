// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { POLICY_EXTENSION_GROUP } from '../../internal/constants';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { extensionGate } from '../extension-gate';
import * as VersionsAPI from './versions';
import { Versions } from './versions';

// ---- Shared primitive types ----------------------------------------------

export interface ModelConfig {
  id: string;
  /** Deployment/provider identifier when the model is provider-qualified. */
  provider?: string;
  speed?: 'standard' | 'fast' | null;
  effort?: ModelEffortType | ModelEffort | null;
}

export type ModelEffortType = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ModelEffort {
  type: ModelEffortType;
}

export interface McpServerDefinition {
  name: string;
  type: 'url';
  url: string;
}

export interface AgentMcpServerInput {
  name: string;
  type?: 'url';
  url: string;
  [key: string]: unknown;
}

export interface AgentCustomToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown> | null;
  required?: string[] | null;
  [key: string]: unknown;
}

export interface AgentPermissionPolicy {
  type: 'always_allow' | 'always_ask';
  [key: string]: unknown;
}

export interface AgentToolDefaultConfig {
  enabled?: boolean | null;
  permission_policy?: AgentPermissionPolicy | null;
  [key: string]: unknown;
}

export interface AgentNamedToolConfig extends AgentToolDefaultConfig {
  name: string;
}

export type AgentToolConfigs = AgentNamedToolConfig[] | Record<string, AgentToolDefaultConfig>;

export type AgentToolDefinition =
  | AgentBuiltinToolsetDefinition
  | AgentMcpToolsetDefinition
  | AgentCustomToolDefinition;

export interface AgentBuiltinToolsetDefinition {
  type: 'agent_toolset' | 'agent_toolset_20260401';
  configs?: AgentToolConfigs;
  default_config?: AgentToolDefaultConfig | null;
  [key: string]: unknown;
}

export interface AgentMcpToolsetDefinition {
  type: 'mcp_toolset';
  mcp_server_name: string;
  configs?: AgentToolConfigs;
  default_config?: AgentToolDefaultConfig | null;
  [key: string]: unknown;
}

export interface AgentCustomToolDefinition {
  type: 'custom';
  name: string;
  description: string;
  input_schema: AgentCustomToolInputSchema;
  [key: string]: unknown;
}

export type AgentSkillDefinition =
  | {
      type: 'anthropic';
      skill_id: string;
      version?: string | null;
      [key: string]: unknown;
    }
  | {
      type: 'custom';
      skill_id: string;
      version?: string | null;
      [key: string]: unknown;
    };

export type AgentMultiagentRosterEntry =
  | string
  | { type: 'agent'; id: string; version?: number }
  | { type: 'self' };

export interface AgentMultiagentDefinition {
  type: 'coordinator';
  agents: AgentMultiagentRosterEntry[];
}

// ---- Agent response type -------------------------------------------------

export type AgentResponseModel =
  | {
      id: string;
      speed?: 'standard' | 'fast';
      effort?: ModelEffort;
    }
  | {
      provider: string;
      id: string;
    };

export type AgentResponseSkillDefinition =
  | { type: 'anthropic'; skill_id: string; version: string }
  | { type: 'custom'; skill_id: string; version: string };

export interface Agent {
  id: string;
  type: 'agent';
  name: string;
  description: string | null;
  model: AgentResponseModel;
  system: string | null;
  mcp_servers: McpServerDefinition[];
  tools: AgentToolDefinition[];
  skills: AgentResponseSkillDefinition[];
  /** Present on policy-extension responses requested with `orca-beta`. */
  guardrail_ids?: string[];
  multiagent: AgentMultiagentDefinition | null;
  metadata: Record<string, string>;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---- Request parameter types ---------------------------------------------

export interface AgentCreateParams {
  /**
   * Model to use. A plain string is shorthand for `{ id: <string> }`.
   */
  model: string | ModelConfig;
  name: string;
  description?: string | null;
  system?: string | null;
  mcp_servers?: AgentMcpServerInput[];
  tools?: AgentToolDefinition[];
  skills?: AgentSkillDefinition[];
  /** Guardrails explicitly attached to this agent. Requires `orca-beta`. */
  guardrail_ids?: string[];
  metadata?: Record<string, string>;
  multiagent?: AgentMultiagentDefinition | null;
}

export interface AgentUpdateParams {
  /** When provided, must match the current version for optimistic concurrency. */
  version?: number;
  name?: string;
  description?: string | null;
  model?: string | ModelConfig;
  system?: string | null;
  mcp_servers?: AgentMcpServerInput[] | null;
  tools?: AgentToolDefinition[] | null;
  skills?: AgentSkillDefinition[] | null;
  /** Replace attached guardrails, or pass `null` to clear them. Requires `orca-beta`. */
  guardrail_ids?: string[] | null;
  multiagent?: AgentMultiagentDefinition | null;
  metadata?: Record<string, string | null> | null;
}

export interface AgentListParams extends PageCursorParams {
  include_archived?: boolean;
}

export interface AgentRetrieveParams {
  /** Retrieve a specific historical version of the agent. */
  version?: number;
}

// ---- Resource class ------------------------------------------------------

export class Agents extends APIResource {
  /** Historical version snapshots for an agent. */
  versions: VersionsAPI.Versions = new Versions(this._client);

  /**
   * Create a new agent in the registry.
   *
   * @example
   * ```ts
   * const agent = await orca.agents.create({
   *   model: 'claude-sonnet-4-6',
   *   name: 'My First Agent',
   * });
   * ```
   */
  create(params: AgentCreateParams, options?: RequestOptions): APIPromise<Agent> {
    const requestOptions = { body: params, ...options };
    return this._client.post(
      '/v1/agents',
      params.guardrail_ids === undefined
        ? requestOptions
        : extensionGate(this._client, POLICY_EXTENSION_GROUP, requestOptions),
    );
  }

  /**
   * Retrieve an agent by ID.  Pass `{ version }` to fetch a specific
   * historical snapshot.
   *
   * @example
   * ```ts
   * const agent = await orca.agents.retrieve('agent_id');
   * const v2 = await orca.agents.retrieve('agent_id', { version: 2 });
   * ```
   */
  retrieve(
    agentId: string,
    params: AgentRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Agent> {
    return this._client.get(path`/v1/agents/${agentId}`, {
      query: params ?? {},
      ...options,
    });
  }

  /**
   * Update an existing agent. Pass `version` to apply optimistic concurrency.
   *
   * @example
   * ```ts
   * const agent = await orca.agents.update('agent_id', {
   *   version: 1,
   *   name: 'New Name',
   * });
   * ```
   */
  update(agentId: string, params: AgentUpdateParams, options?: RequestOptions): APIPromise<Agent> {
    const requestOptions = { body: params, ...options };
    return this._client.post(
      path`/v1/agents/${agentId}`,
      params.guardrail_ids === undefined
        ? requestOptions
        : extensionGate(this._client, POLICY_EXTENSION_GROUP, requestOptions),
    );
  }

  /**
   * List agents, optionally including archived agents.
   *
   * @example
   * ```ts
   * const page = await orca.agents.list();
   * for await (const agent of orca.agents.list()) { ... }
   * ```
   */
  list(params: AgentListParams = {}, options?: RequestOptions): PagePromise<PageCursor<Agent>, Agent> {
    return this._client.getAPIList('/v1/agents', PageCursor<Agent>, {
      query: params,
      ...options,
    });
  }

  /**
   * Archive (soft-delete) an agent.
   *
   * @example
   * ```ts
   * await orca.agents.archive('agent_id');
   * ```
   */
  archive(agentId: string, options?: RequestOptions): APIPromise<Agent> {
    return this._client.post(path`/v1/agents/${agentId}/archive`, {
      ...options,
    });
  }
}
