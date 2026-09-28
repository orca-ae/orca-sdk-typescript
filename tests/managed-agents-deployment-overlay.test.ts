// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type {
  AgentListParams,
  CredentialListParams,
  EnvironmentCreateParams,
  EnvironmentListParams,
  EnvironmentUpdateParams,
  EventListParams,
  EventStreamParams,
  FileListParams,
  MemoryListParams,
  MemoryStoreListParams,
  MemoryVersionListParams,
  MemoryVersionRetrieveParams,
  Orca,
  SessionListParams,
  SkillListParams,
  ThreadEventStreamParams,
  TriggerListParams,
  TriggerSessionMode,
  TriggerSourceCreateParams,
  VaultListParams,
} from '../src';

type Assert<T extends true> = T;
type HasNone<T, Keys extends PropertyKey> = Extract<keyof T, Keys> extends never ? true : false;
type HasAll<T, Keys extends PropertyKey> = Exclude<Keys, keyof T> extends never ? true : false;
type Includes<Union, Values> = Exclude<Values, Union> extends never ? true : false;

type EnvironmentFlatFields = 'packages' | 'networking' | 'image' | 'target';
type _EnvironmentCreateUsesConfig = Assert<HasNone<EnvironmentCreateParams, EnvironmentFlatFields>>;
type _EnvironmentUpdateUsesConfig = Assert<HasNone<EnvironmentUpdateParams, EnvironmentFlatFields>>;

type _AgentListUsesSharedFilters = Assert<HasNone<AgentListParams, 'created_at[gte]' | 'created_at[lte]'>>;
type _SessionListUsesSharedFilters = Assert<
  HasNone<
    SessionListParams,
    | 'agent_version'
    | 'created_at[gt]'
    | 'created_at[gte]'
    | 'created_at[lt]'
    | 'created_at[lte]'
    | 'deployment_id'
    | 'memory_store_id'
    | 'order'
    | 'statuses'
  >
>;
type _FileListUsesSharedFilters = Assert<HasNone<FileListParams, 'scope_id'>>;
type _MemoryStoreListUsesSharedFilters = Assert<
  HasNone<MemoryStoreListParams, 'created_at[gte]' | 'created_at[lte]'>
>;
type _MemoryListUsesSharedFilters = Assert<HasAll<MemoryListParams, 'depth' | 'path_prefix' | 'view'>>;
type _MemoryVersionListUsesSharedFilters = Assert<
  HasAll<
    MemoryVersionListParams,
    'api_key_id' | 'operation' | 'created_at[gte]' | 'created_at[lte]' | 'view'
  >
>;
type _MemoryVersionSessionFilterIsNotPortable = Assert<
  HasNone<MemoryVersionListParams, 'session_id'>
>;
type _EventListUsesSharedFilters = Assert<
  HasAll<
    EventListParams,
    'created_at[gt]' | 'created_at[gte]' | 'created_at[lt]' | 'created_at[lte]' | 'types' | 'subpath'
  >
>;
type _SkillListUsesSharedFilters = Assert<HasNone<SkillListParams, 'source' | 'include_archived'>>;
type _TriggerListUsesSharedFilters = Assert<HasNone<TriggerListParams, 'include_archived'>>;
type _TriggerSourcesIncludeManagedDeploymentCapabilities = Assert<
  Includes<TriggerSourceCreateParams['type'], 'cron' | 'kafka' | 'pulsar'>
>;
type _TriggerModesIncludeManagedDeploymentCapabilities = Assert<
  Includes<
    TriggerSessionMode,
    'SESSION_PER_EVENT' | 'SESSION_PER_TOPIC' | 'SESSION_PER_KEY' | 'SHARED'
  >
>;
type _CredentialListUsesSharedFilters = Assert<HasAll<CredentialListParams, 'include_archived'>>;
type _SessionStreamUsesSharedParams = Assert<
  HasAll<EventStreamParams, 'from_cursor' | 'subpath' | 'event_deltas'>
>;
type _ThreadStreamUsesSharedParams = Assert<
  HasAll<ThreadEventStreamParams, 'from_cursor' | 'event_deltas'>
>;
type _MemoryVersionRetrieveUsesSharedParams = Assert<
  HasAll<MemoryVersionRetrieveParams, 'view'>
>;

type _AgentProviderFilterIsNotPortable = Assert<HasNone<AgentListParams, 'provider'>>;
type _EnvironmentProviderFilterIsNotPortable = Assert<HasNone<EnvironmentListParams, 'provider'>>;
type _FileProviderFilterIsNotPortable = Assert<HasNone<FileListParams, 'provider'>>;
type _MemoryStoreProviderFilterIsNotPortable = Assert<HasNone<MemoryStoreListParams, 'provider'>>;
type _SessionProviderFilterIsNotPortable = Assert<HasNone<SessionListParams, 'provider'>>;
type _SkillProviderFilterIsNotPortable = Assert<HasNone<SkillListParams, 'provider'>>;
type _VaultProviderFilterIsNotPortable = Assert<HasNone<VaultListParams, 'provider'>>;

type _AgentDeleteIsNotPortable = Assert<HasNone<Orca['agents'], 'delete'>>;
type _GitCredentialsOperationIsNotPortable = Assert<HasNone<Orca, 'gitCreds'>>;
type _CloudAgentFunctionsAreNotAdvertised = Assert<HasNone<Orca['cloud'], 'agentFunctions'>>;
type _CloudTriggersWerePromotedToCore = Assert<HasNone<Orca['cloud'], 'triggers'>>;
type _CoreTriggersArePortable = Assert<HasAll<Orca, 'triggers'>>;

function assertSharedQueryParams(orca: Orca): void {
  void orca.sessions.events.stream('session_id', {
    from_cursor: 'event_id',
    subpath: '/child',
    event_deltas: 'agent.message',
  });
  void orca.sessions.threads.events.stream('session_id', 'thread_id', {
    from_cursor: 'event_id',
    event_deltas: 'agent.message',
  });
  void orca.memoryStores.memoryVersions.retrieve('store_id', 'version_id', { view: 'basic' });

  // @ts-expect-error session_id requires local-to-provider ID translation.
  void orca.memoryStores.memoryVersions.list('store_id', { session_id: 'session_id' });
}

void assertSharedQueryParams;

test('public request types follow the shared deployment contract', () => {
  expect(true).toBe(true);
});
