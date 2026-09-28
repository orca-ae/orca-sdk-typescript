// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Orca } from '../src/client';

type Assert<T extends true> = T;
type IsUnknown<T> = unknown extends T ? ([keyof T] extends [never] ? true : false) : false;
type ResolvedReturn<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

type _PackageListResponseIsUnspecified = Assert<IsUnknown<ResolvedReturn<Orca['cloud']['packages']['list']>>>;
type _PackageVersionListResponseIsUnspecified = Assert<
  IsUnknown<ResolvedReturn<Orca['cloud']['packages']['listVersions']>>
>;
type _PackageMetadataResponseIsUnspecified = Assert<
  IsUnknown<ResolvedReturn<Orca['cloud']['packages']['retrieveMetadata']>>
>;

const sdkOperations: Record<string, (orca: Orca) => unknown> = {
  getApiResources: (orca) => orca.cloud.apiResources.list,
  getProvider: (orca) => orca.cloud.agents.providers.retrieve,
  listProviders: (orca) => orca.cloud.agents.providers.list,
  getKafkaConnectorConfigDefinition: (orca) => orca.cloud.catalog.kafka.retrieve,
  getKafkaConnectorList: (orca) => orca.cloud.catalog.kafka.list,
  getSinkConfigDefinition: (orca) => orca.cloud.catalog.sinks.retrieve,
  getSinkList: (orca) => orca.cloud.catalog.sinks.list,
  getSourceConfigDefinition: (orca) => orca.cloud.catalog.sources.retrieve,
  getSourceList: (orca) => orca.cloud.catalog.sources.list,
  listConnections: (orca) => orca.cloud.connections.list,
  createConnection: (orca) => orca.cloud.connections.create,
  getConnection: (orca) => orca.cloud.connections.retrieve,
  updateConnection: (orca) => orca.cloud.connections.update,
  deleteConnection: (orca) => orca.cloud.connections.delete,
  testConnection: (orca) => orca.cloud.connections.test,
  validateConnection: (orca) => orca.cloud.connections.validate,
  getFunctionInfoWithDefaults: (orca) => orca.cloud.functions.retrieve,
  updateFunctionWithDefaults: (orca) => orca.cloud.functions.update,
  registerFunctionWithDefaults: (orca) => orca.cloud.functions.create,
  deregisterFunctionWithDefaults: (orca) => orca.cloud.functions.delete,
  getFunctionInstanceStatsWithDefaults: (orca) => orca.cloud.functions.retrieveInstanceStats,
  getFunctionInstanceStatusWithDefaults: (orca) => orca.cloud.functions.retrieveInstanceStatus,
  getFunctionStateWithDefaults: (orca) => orca.cloud.functions.retrieveState,
  putFunctionStateWithDefaults: (orca) => orca.cloud.functions.updateState,
  getFunctionStatsWithDefaults: (orca) => orca.cloud.functions.retrieveStats,
  getFunctionStatusWithDefaults: (orca) => orca.cloud.functions.retrieveStatus,
  listFunctionsWithDefaults: (orca) => orca.cloud.functions.list,
  restartFunctionAllWithDefaults: (orca) => orca.cloud.functions.restart,
  restartFunctionWithDefaults: (orca) => orca.cloud.functions.restartInstance,
  startFunctionAllWithDefaults: (orca) => orca.cloud.functions.start,
  startFunctionWithDefaults: (orca) => orca.cloud.functions.startInstance,
  stopFunctionAllWithDefaults: (orca) => orca.cloud.functions.stop,
  stopFunctionWithDefaults: (orca) => orca.cloud.functions.stopInstance,
  triggerFunctionWithDefaults: (orca) => orca.cloud.functions.trigger,
  health: (orca) => orca.cloud.health.check,
  isInitialized: (orca) => orca.cloud.health.ready,
  liveness: (orca) => orca.cloud.health.live,
  download: (orca) => orca.cloud.packages.download,
  upload: (orca) => orca.cloud.packages.upload,
  delete: (orca) => orca.cloud.packages.delete,
  getMeta: (orca) => orca.cloud.packages.retrieveMetadata,
  updateMeta: (orca) => orca.cloud.packages.updateMetadata,
  listPackageVersion: (orca) => orca.cloud.packages.listVersions,
  listPackages: (orca) => orca.cloud.packages.list,
  getSinkInfoWithDefaults: (orca) => orca.cloud.connectors.sinks.retrieve,
  updateSinkWithDefaults: (orca) => orca.cloud.connectors.sinks.update,
  registerSinkWithDefaults: (orca) => orca.cloud.connectors.sinks.create,
  deregisterSinkWithDefaults: (orca) => orca.cloud.connectors.sinks.delete,
  getSinkInstanceStatusWithDefaults: (orca) => orca.cloud.connectors.sinks.retrieveInstanceStatus,
  getSinkStatusWithDefaults: (orca) => orca.cloud.connectors.sinks.retrieveStatus,
  listSinkWithDefaults: (orca) => orca.cloud.connectors.sinks.list,
  restartSinkAllWithDefaults: (orca) => orca.cloud.connectors.sinks.restart,
  restartSinkWithDefaults: (orca) => orca.cloud.connectors.sinks.restartInstance,
  startSinkAllWithDefaults: (orca) => orca.cloud.connectors.sinks.start,
  startSinkWithDefaults: (orca) => orca.cloud.connectors.sinks.startInstance,
  stopSinkAllWithDefaults: (orca) => orca.cloud.connectors.sinks.stop,
  stopSinkWithDefaults: (orca) => orca.cloud.connectors.sinks.stopInstance,
  getSourceInfoWithDefaults: (orca) => orca.cloud.connectors.sources.retrieve,
  updateSourceWithDefaults: (orca) => orca.cloud.connectors.sources.update,
  registerSourceWithDefaults: (orca) => orca.cloud.connectors.sources.create,
  deregisterSourceWithDefaults: (orca) => orca.cloud.connectors.sources.delete,
  getSourceInstanceStatusWithDefaults: (orca) => orca.cloud.connectors.sources.retrieveInstanceStatus,
  getSourceStatusWithDefaults: (orca) => orca.cloud.connectors.sources.retrieveStatus,
  listSourcesWithDefaults: (orca) => orca.cloud.connectors.sources.list,
  restartSourceAllWithDefaults: (orca) => orca.cloud.connectors.sources.restart,
  restartSourceWithDefaults: (orca) => orca.cloud.connectors.sources.restartInstance,
  startSourceAllWithDefaults: (orca) => orca.cloud.connectors.sources.start,
  startSourceWithDefaults: (orca) => orca.cloud.connectors.sources.startInstance,
  stopSourceAllWithDefaults: (orca) => orca.cloud.connectors.sources.stop,
  stopSourceWithDefaults: (orca) => orca.cloud.connectors.sources.stopInstance,
  getConnectorConfigDef: (orca) => orca.cloud.connectors.kafka.plugins.retrieveConfig,
  listConnectorPlugins: (orca) => orca.cloud.connectors.kafka.plugins.list,
  listConnectorPluginsCatalog: (orca) => orca.cloud.connectors.kafka.plugins.listCatalog,
  healthCheck: (orca) => orca.cloud.connectors.kafka.health,
  serverInfo: (orca) => orca.cloud.connectors.kafka.serverInfo,
  getOffsets: (orca) => orca.cloud.connectors.kafka.connectors.retrieveOffsets,
  resetConnectorOffsets: (orca) => orca.cloud.connectors.kafka.connectors.resetOffsets,
  alterConnectorOffsets: (orca) => orca.cloud.connectors.kafka.connectors.updateOffsets,
  listConnectors: (orca) => orca.cloud.connectors.kafka.connectors.list,
  createConnector: (orca) => orca.cloud.connectors.kafka.connectors.create,
  getConnector: (orca) => orca.cloud.connectors.kafka.connectors.retrieve,
  destroyConnector: (orca) => orca.cloud.connectors.kafka.connectors.delete,
  getConnectorActiveTopics: (orca) => orca.cloud.connectors.kafka.connectors.retrieveActiveTopics,
  getConnectorConfig: (orca) => orca.cloud.connectors.kafka.connectors.retrieveConfig,
  putConnectorConfig: (orca) => orca.cloud.connectors.kafka.connectors.updateConfig,
  getConnectorStatus: (orca) => orca.cloud.connectors.kafka.connectors.retrieveStatus,
  getTaskConfigs: (orca) => orca.cloud.connectors.kafka.connectors.listTasks,
  getTaskStatus: (orca) => orca.cloud.connectors.kafka.connectors.retrieveTaskStatus,
  getTasksConfig: (orca) => orca.cloud.connectors.kafka.connectors.retrieveTasksConfig,
  pauseConnector: (orca) => orca.cloud.connectors.kafka.connectors.pause,
  resetConnectorActiveTopics: (orca) => orca.cloud.connectors.kafka.connectors.resetActiveTopics,
  restartConnector: (orca) => orca.cloud.connectors.kafka.connectors.restart,
  restartTask: (orca) => orca.cloud.connectors.kafka.connectors.restartTask,
  resumeConnector: (orca) => orca.cloud.connectors.kafka.connectors.resume,
  stopConnector: (orca) => orca.cloud.connectors.kafka.connectors.stop,
};

describe('cloud extension contract coverage', () => {
  const spec = readFileSync(resolve(__dirname, '../openapi/cloud-extensions.yaml'), 'utf8');
  const operationIDs = [...spec.matchAll(/^\s+operationId:\s+(\S+)$/gm)].map((match) => match[1]!);

  it('exposes every functional operationId in the vendored spec', () => {
    const functionalOperationIDs = operationIDs.filter((id) => id !== 'validateConfigs').sort();
    expect(Object.keys(sdkOperations).sort()).toEqual(functionalOperationIDs);
  });

  it('maps every tracked operationId to a callable SDK method', () => {
    const orca = new Orca({ baseURL: 'https://api.example.test' });
    for (const accessor of Object.values(sdkOperations)) {
      expect(typeof accessor(orca)).toBe('function');
    }
  });

  it('does not expose the config validation operation whose only declared response is unsupported', () => {
    const orca = new Orca({ baseURL: 'https://api.example.test' });
    expect('validate' in orca.cloud.connectors.kafka.plugins).toBe(false);
  });

  it('does not retain Triggers after their promotion to the core API', () => {
    const orca = new Orca({ baseURL: 'https://api.example.test' });
    expect('triggers' in orca.cloud).toBe(false);
  });
});
