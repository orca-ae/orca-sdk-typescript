// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PagePromise } from '../../core/pagination';
import { POLICY_EXTENSION_GROUP } from '../../internal/constants';
import { path } from '../../internal/utils/path';
import type { RequestOptions } from '../../internal/request-options';
import { extensionGate } from '../extension-gate';
import { Events } from './events';
import type { MessageContentBlock, NonEmptyArray, OutcomeRubric } from './events';
import { SessionFiles } from './files';
import { Resources } from './resources';
import { Threads } from './threads';
import type {
  AgentResponseModel,
  AgentSkillDefinition,
  AgentToolDefinition,
  McpServerDefinition,
  ModelConfig,
} from '../agents';
import type { SessionResource, SessionResourceRequest } from './resources';

// ---- Session response types ------------------------------------------------

export interface SessionStats {
  active_seconds?: number;
  duration_seconds?: number;
}

export interface SessionCacheCreationUsage {
  ephemeral_1h_input_tokens?: number;
  ephemeral_5m_input_tokens?: number;
}

export interface SessionUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: SessionCacheCreationUsage;
}

export type SessionStatus = 'rescheduling' | 'running' | 'idle' | 'terminated';

export interface SessionTiming {
  started_at: string | null;
  last_active_at: string | null;
  active_seconds: number;
  duration_seconds: number;
}

export interface OutcomeEvaluation {
  type: 'outcome_evaluation';
  outcome_id: string;
  description: string;
  result: string;
  explanation: string | null;
  iteration: number;
  completed_at: string | null;
  [key: string]: unknown;
}

export interface SessionAgentMember {
  id: string;
  type: 'agent';
  name: string;
  description: string | null;
  version: number;
  model: AgentResponseModel;
  system: string | null;
  tools: AgentToolDefinition[];
  mcp_servers: McpServerDefinition[];
  skills: AgentSkillDefinition[];
}

export interface SessionAgent extends SessionAgentMember {
  multiagent: {
    type: 'coordinator';
    agents: SessionAgentMember[];
  } | null;
}

export interface Session {
  id: string;
  type: 'session';
  /** Agent snapshot at creation time. */
  agent: SessionAgent;
  environment_id: string;
  vault_ids: string[];
  status: SessionStatus;
  title: string | null;
  stats: SessionStats;
  timing?: SessionTiming;
  deployment_id?: string | null;
  outcome_evaluations: OutcomeEvaluation[];
  usage: SessionUsage;
  resources: SessionResource[];
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface DeletedSession {
  id: string;
  type: 'session_deleted';
}

// ---- Request parameter types -----------------------------------------------

export interface SessionAgentReference {
  type: 'agent';
  id: string;
  version?: number;
}

export interface SessionAgentWithOverrides {
  type: 'agent_with_overrides';
  id: string;
  version?: number;
  model?: string | ModelConfig;
  system?: string | null;
  tools?: AgentToolDefinition[];
  mcp_servers?: McpServerDefinition[];
  skills?: AgentSkillDefinition[];
  /** Session-local guardrails for this agent snapshot. Requires `orca-beta`. */
  guardrail_ids?: string[];
}

export type SessionAgentInput = string | SessionAgentReference | SessionAgentWithOverrides;

export interface SessionAgentUpdate {
  tools?: AgentToolDefinition[];
  mcp_servers?: McpServerDefinition[];
}

export interface SessionUserMessageInitialEvent {
  type: 'user.message';
  content: NonEmptyArray<MessageContentBlock>;
}

export interface SessionDefineOutcomeInitialEvent {
  type: 'user.define_outcome';
  description: string;
  rubric: OutcomeRubric;
  max_iterations?: number | null;
}

export type SessionInitialEvent = SessionUserMessageInitialEvent | SessionDefineOutcomeInitialEvent;

export interface SessionCreateParams {
  /**
   * Agent reference. A plain string is shorthand for `{ id: <string> }`.
   * Omit this only when using the legacy `agent_id` field.
   */
  agent?: SessionAgentInput;
  /** Compatibility form of the agent reference accepted by both backends. */
  agent_id?: string;
  environment_id: string;
  vault_ids?: string[];
  title?: string | null;
  metadata?: Record<string, string>;
  resources?: SessionResourceRequest[];
  /** Events applied before the agent's first turn. */
  initial_events?: SessionInitialEvent[];
}

export interface SessionUpdateParams {
  agent?: SessionAgentUpdate;
  vault_ids?: string[];
  title?: string | null;
  metadata?: Record<string, string | null> | null;
}

export interface SessionListParams {
  /** Filter by the agent that owns the session. */
  agent_id?: string;
  limit?: number;
  page?: string;
  include_archived?: boolean | null;
}

// ---- Resource class --------------------------------------------------------

export class Sessions extends APIResource {
  /** Session events sub-resource. */
  events: Events = new Events(this._client);

  /** Session files sub-resource. */
  files: SessionFiles = new SessionFiles(this._client);

  /** Session resources sub-resource. */
  resources: Resources = new Resources(this._client);

  /** Session threads sub-resource. */
  threads: Threads = new Threads(this._client);

  /**
   * Create a new session. The body's `agent` field identifies which agent
   * the session belongs to.
   *
   * @example
   * ```ts
   * const session = await orca.sessions.create({
   *   agent: 'agent_id',
   *   environment_id: 'env_id',
   * });
   * ```
   */
  create(params: SessionCreateParams, options?: RequestOptions): APIPromise<Session> {
    const requestOptions = {
      body: params,
      ...options,
    };
    const hasGuardrailOverrides =
      typeof params.agent === 'object' &&
      params.agent.type === 'agent_with_overrides' &&
      params.agent.guardrail_ids !== undefined;

    return this._client.post(
      '/v1/sessions',
      hasGuardrailOverrides
        ? extensionGate(this._client, POLICY_EXTENSION_GROUP, requestOptions)
        : requestOptions,
    );
  }

  /**
   * Retrieve a session by ID.
   *
   * @example
   * ```ts
   * const session = await orca.sessions.retrieve('session_id');
   * ```
   */
  retrieve(sessionId: string, options?: RequestOptions): APIPromise<Session> {
    return this._client.get(path`/v1/sessions/${sessionId}`, { ...options });
  }

  /**
   * Update an existing session.
   *
   * @example
   * ```ts
   * const session = await orca.sessions.update('session_id', { title: 'New Title' });
   * ```
   */
  update(sessionId: string, params: SessionUpdateParams, options?: RequestOptions): APIPromise<Session> {
    return this._client.post(path`/v1/sessions/${sessionId}`, {
      body: params,
      ...options,
    });
  }

  /**
   * List sessions. Pass `agent_id` to filter to a single agent.
   *
   * @example
   * ```ts
   * const page = await orca.sessions.list({ agent_id: 'agent_id' });
   * for await (const session of orca.sessions.list()) { ... }
   * ```
   */
  list(params: SessionListParams = {}, options?: RequestOptions): PagePromise<PageCursor<Session>, Session> {
    return this._client.getAPIList('/v1/sessions', PageCursor<Session>, {
      query: params,
      ...options,
    });
  }

  /**
   * Delete a session permanently.
   *
   * @example
   * ```ts
   * const deleted = await orca.sessions.delete('session_id');
   * ```
   */
  delete(sessionId: string, options?: RequestOptions): APIPromise<DeletedSession> {
    return this._client.delete(path`/v1/sessions/${sessionId}`, { ...options });
  }

  /**
   * Archive a session.
   *
   * @example
   * ```ts
   * await orca.sessions.archive('session_id');
   * ```
   */
  archive(sessionId: string, options?: RequestOptions): APIPromise<Session> {
    return this._client.post(path`/v1/sessions/${sessionId}/archive`, {
      ...options,
    });
  }
}
