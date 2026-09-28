// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import * as SessionsAPI from './sessions';
import { Sessions } from './sessions';

export type TriggerSessionMode = 'SESSION_PER_EVENT' | 'SESSION_PER_TOPIC' | 'SESSION_PER_KEY' | 'SHARED';

export type TriggerCronSessionMode = 'SESSION_PER_EVENT' | 'SHARED';

export type TriggerSourceType = 'cron' | 'kafka' | 'pulsar';

export type TriggerStatus = 'active' | 'paused' | 'archived';

export interface TriggerAgent {
  type: 'agent';
  id: string;
  version: number;
}

export interface TriggerAgentReference {
  type: 'agent';
  id: string;
  version?: number;
}

export type TriggerAgentInput = string | TriggerAgentReference;

export interface TriggerSessionConfig {
  environment_id: string;
  title_template: string | null;
  metadata: Record<string, string>;
  vault_ids: string[];
}

export interface TriggerSessionCreateParams {
  environment_id: string;
  title_template?: string | null;
  metadata?: Record<string, string>;
  vault_ids?: string[];
}

export interface TriggerSessionUpdateParams {
  environment_id?: string;
  title_template?: string | null;
  metadata?: Record<string, string | null>;
  vault_ids?: string[];
}

export interface TriggerInputSchemaConfig {
  subject?: string | null;
  type?: string | null;
  version?: number | null;
}

export type TriggerTopicSelector =
  | { topics: string[]; topic_pattern?: never }
  | { topics?: never; topic_pattern: string };

export type TriggerTopicSelectorUpdate =
  | { topics?: string[]; topic_pattern?: never }
  | { topics?: never; topic_pattern?: string };

export interface TriggerCronSource {
  type: 'cron';
  schedule: string;
  timezone: string;
  payload: string;
}

export interface TriggerCronSourceCreateParams {
  type: 'cron';
  schedule: string;
  timezone?: string;
  payload: string;
}

export interface TriggerCronSourceUpdateParams {
  type: 'cron';
  schedule?: string;
  timezone?: string;
  payload?: string;
}

export interface TriggerMessagingSourceBase {
  connection: string;
  subscription_name?: string;
  type_class_name?: string;
  type_class_definition?: string;
  schema_type?: string;
}

export interface TriggerKafkaSourceBase extends TriggerMessagingSourceBase {
  type: 'kafka';
  /** Connector-specific consumer settings; the deployment schema leaves this object open. */
  consumer_additional_config?: Record<string, unknown>;
  input_schema_configs?: Record<string, TriggerInputSchemaConfig>;
}

export interface TriggerPulsarSourceBase extends TriggerMessagingSourceBase {
  type: 'pulsar';
}

export type TriggerKafkaSource = TriggerKafkaSourceBase & TriggerTopicSelector;
export type TriggerPulsarSource = TriggerPulsarSourceBase & TriggerTopicSelector;

export type TriggerKafkaSourceUpdateParams = Omit<TriggerKafkaSourceBase, 'connection'> &
  Partial<Pick<TriggerKafkaSourceBase, 'connection'>> &
  TriggerTopicSelectorUpdate;

export type TriggerPulsarSourceUpdateParams = Omit<TriggerPulsarSourceBase, 'connection'> &
  Partial<Pick<TriggerPulsarSourceBase, 'connection'>> &
  TriggerTopicSelectorUpdate;

export type TriggerSource = TriggerCronSource | TriggerKafkaSource | TriggerPulsarSource;

export type TriggerSourceCreateParams =
  | TriggerCronSourceCreateParams
  | TriggerKafkaSource
  | TriggerPulsarSource;

export type TriggerSourceUpdateParams =
  | TriggerCronSourceUpdateParams
  | TriggerKafkaSourceUpdateParams
  | TriggerPulsarSourceUpdateParams;

export interface TriggerBase {
  id: string;
  type: 'trigger';
  name: string;
  agent: TriggerAgent;
  session: TriggerSessionConfig;
  replicas: number;
  status: TriggerStatus;
  next_fire_at: string | null;
  last_fired_at: string | null;
  error: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Trigger =
  | (TriggerBase & { session_mode: TriggerCronSessionMode; source: TriggerCronSource })
  | (TriggerBase & {
      session_mode: TriggerSessionMode;
      source: TriggerKafkaSource | TriggerPulsarSource;
    });

export interface DeletedTrigger {
  id: string;
  type: 'trigger_deleted';
}

interface TriggerCreateBase {
  name: string;
  agent: TriggerAgentInput;
  session: TriggerSessionCreateParams;
  replicas?: number;
  paused?: boolean;
}

export type TriggerCreateParams =
  | (TriggerCreateBase & {
      session_mode: TriggerCronSessionMode;
      source: TriggerCronSourceCreateParams;
    })
  | (TriggerCreateBase & {
      session_mode: TriggerSessionMode;
      source: TriggerKafkaSource | TriggerPulsarSource;
    });

interface TriggerUpdateBase {
  name?: string;
  session?: TriggerSessionUpdateParams;
  replicas?: number;
}

export type TriggerUpdateParams =
  | (TriggerUpdateBase & { source?: undefined; session_mode?: TriggerSessionMode })
  | (TriggerUpdateBase & {
      source: TriggerCronSourceUpdateParams;
      session_mode?: TriggerCronSessionMode;
    })
  | (TriggerUpdateBase & {
      source: TriggerKafkaSourceUpdateParams | TriggerPulsarSourceUpdateParams;
      session_mode?: TriggerSessionMode;
    });

export interface TriggerListParams extends PageCursorParams {
  agent_id?: string;
}

/** Trigger lifecycle shared by every supported deployment. */
export class Triggers extends APIResource {
  /** Sessions produced by a trigger. */
  sessions: SessionsAPI.Sessions = new Sessions(this._client);

  /**
   * Create a trigger.
   *
   * @example
   * ```ts
   * const trigger = await orca.triggers.create({
   *   name: 'daily-summary',
   *   agent: { type: 'agent', id: 'agent_id' },
   *   session_mode: 'SESSION_PER_EVENT',
   *   source: { type: 'cron', schedule: '0 9 * * *', timezone: 'Etc/UTC', payload: 'Summarize.' },
   *   session: { environment_id: 'env_id' },
   * });
   * ```
   */
  create(params: TriggerCreateParams, options?: RequestOptions): APIPromise<Trigger> {
    return this._client.post('/v1/triggers', { body: params, ...options });
  }

  /**
   * List triggers.
   *
   * @example
   * ```ts
   * for await (const trigger of orca.triggers.list({ agent_id: 'agent_id' })) { ... }
   * ```
   */
  list(params: TriggerListParams = {}, options?: RequestOptions): PagePromise<PageCursor<Trigger>, Trigger> {
    return this._client.getAPIList('/v1/triggers', PageCursor<Trigger>, {
      query: params,
      ...options,
    });
  }

  /**
   * Retrieve a trigger by ID.
   *
   * @example
   * ```ts
   * const trigger = await orca.triggers.retrieve('trigger_id');
   * ```
   */
  retrieve(triggerId: string, options?: RequestOptions): APIPromise<Trigger> {
    return this._client.get(path`/v1/triggers/${triggerId}`, { ...options });
  }

  /**
   * Partially update a trigger.
   *
   * @example
   * ```ts
   * const trigger = await orca.triggers.update('trigger_id', {
   *   source: { type: 'cron', schedule: '0 10 * * *' },
   * });
   * ```
   */
  update(triggerId: string, params: TriggerUpdateParams, options?: RequestOptions): APIPromise<Trigger> {
    return this._client.post(path`/v1/triggers/${triggerId}`, { body: params, ...options });
  }

  /**
   * Delete a trigger and return its tombstone.
   *
   * @example
   * ```ts
   * const deleted = await orca.triggers.delete('trigger_id');
   * ```
   */
  delete(triggerId: string, options?: RequestOptions): APIPromise<DeletedTrigger> {
    return this._client.delete(path`/v1/triggers/${triggerId}`, { ...options });
  }

  /**
   * Pause a trigger without deleting its configuration.
   *
   * @example
   * ```ts
   * const trigger = await orca.triggers.pause('trigger_id');
   * ```
   */
  pause(triggerId: string, options?: RequestOptions): APIPromise<Trigger> {
    return this._client.post(path`/v1/triggers/${triggerId}/pause`, { ...options });
  }

  /**
   * Resume a paused trigger.
   *
   * @example
   * ```ts
   * const trigger = await orca.triggers.unpause('trigger_id');
   * ```
   */
  unpause(triggerId: string, options?: RequestOptions): APIPromise<Trigger> {
    return this._client.post(path`/v1/triggers/${triggerId}/unpause`, { ...options });
  }
}
