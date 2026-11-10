// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Orca } from '../src/client';

// Explicit accessors make missing public methods a compile-time failure.
const implemented: Record<string, (orca: Orca) => unknown> = {
  'discovery.groups': (orca) => orca.discovery.groups,
  'discovery.policyGroupResources': (orca) => orca.discovery.policyGroupResources,
  'guardrails.effective': (orca) => orca.guardrails.effective,
  'guardrails.create': (orca) => orca.guardrails.create,
  'guardrails.list': (orca) => orca.guardrails.list,
  'guardrails.get': (orca) => orca.guardrails.retrieve,
  'guardrails.update': (orca) => orca.guardrails.update,
  'guardrails.delete': (orca) => orca.guardrails.delete,
  'guardrails.archive': (orca) => orca.guardrails.archive,
  'guardrails.listTypes': (orca) => orca.guardrails.listTypes,
  'guardrails.dogwoodSchema': (orca) => orca.guardrails.dogwoodSchema,
  'discovery.pricingGroupResources': (orca) => orca.discovery.pricingGroupResources,
  'modelPrices.list': (orca) => orca.modelPrices.list,
  'modelPrices.get': (orca) => orca.modelPrices.retrieve,
  'discovery.pricingV2GroupResources': (orca) => orca.discovery.pricingV2GroupResources,
  'modelPriceRules.list': (orca) => orca.modelPriceRules.list,
  'discovery.runtimeGroupResources': (orca) => orca.discovery.runtimeGroupResources,
  'discovery.harnesses': (orca) => orca.discovery.harnesses,
  'agents.create': (orca) => orca.agents.create,
  'agents.list': (orca) => orca.agents.list,
  'agents.get': (orca) => orca.agents.retrieve,
  'agents.update': (orca) => orca.agents.update,
  'agents.archive': (orca) => orca.agents.archive,
  'agents.listVersions': (orca) => orca.agents.versions.list,
  'environments.create': (orca) => orca.environments.create,
  'environments.list': (orca) => orca.environments.list,
  'environments.get': (orca) => orca.environments.retrieve,
  'environments.update': (orca) => orca.environments.update,
  'environments.delete': (orca) => orca.environments.delete,
  'environments.archive': (orca) => orca.environments.archive,
  'environments.revokeKey': (orca) => orca.environments.revokeKey,
  'environments.rotateKey': (orca) => orca.environments.rotateKey,
  'environments.workStats': (orca) => orca.environments.workStats,
  'files.create': (orca) => orca.files.upload,
  'files.list': (orca) => orca.files.list,
  'files.get': (orca) => orca.files.retrieve,
  'files.delete': (orca) => orca.files.delete,
  'files.getContent': (orca) => orca.files.download,
  'memoryStores.create': (orca) => orca.memoryStores.create,
  'memoryStores.list': (orca) => orca.memoryStores.list,
  'memoryStores.get': (orca) => orca.memoryStores.retrieve,
  'memoryStores.update': (orca) => orca.memoryStores.update,
  'memoryStores.delete': (orca) => orca.memoryStores.delete,
  'memoryStores.archive': (orca) => orca.memoryStores.archive,
  'memoryStores.createMemory': (orca) => orca.memoryStores.memories.create,
  'memoryStores.listMemories': (orca) => orca.memoryStores.memories.list,
  'memoryStores.getMemory': (orca) => orca.memoryStores.memories.retrieve,
  'memoryStores.updateMemory': (orca) => orca.memoryStores.memories.update,
  'memoryStores.deleteMemory': (orca) => orca.memoryStores.memories.delete,
  'memoryStores.listVersions': (orca) => orca.memoryStores.memoryVersions.list,
  'memoryStores.getVersion': (orca) => orca.memoryStores.memoryVersions.retrieve,
  'memoryStores.redactVersion': (orca) => orca.memoryStores.memoryVersions.redact,
  'sessions.create': (orca) => orca.sessions.create,
  'sessions.list': (orca) => orca.sessions.list,
  'sessions.get': (orca) => orca.sessions.retrieve,
  'sessions.update': (orca) => orca.sessions.update,
  'sessions.delete': (orca) => orca.sessions.delete,
  'sessions.archive': (orca) => orca.sessions.archive,
  'sessions.appendEvents': (orca) => orca.sessions.events.send,
  'sessions.listEvents': (orca) => orca.sessions.events.list,
  'sessions.streamEvents': (orca) => orca.sessions.events.stream,
  'sessions.listFiles': (orca) => orca.sessions.files.list,
  'sessions.getFile': (orca) => orca.sessions.files.retrieve,
  'sessions.deleteFile': (orca) => orca.sessions.files.delete,
  'sessions.getFileContent': (orca) => orca.sessions.files.download,
  'sessions.attachResource': (orca) => orca.sessions.resources.add,
  'sessions.listResources': (orca) => orca.sessions.resources.list,
  'sessions.getResource': (orca) => orca.sessions.resources.retrieve,
  'sessions.updateResource': (orca) => orca.sessions.resources.update,
  'sessions.detachResource': (orca) => orca.sessions.resources.delete,
  'sessions.listThreads': (orca) => orca.sessions.threads.list,
  'sessions.retrieveThread': (orca) => orca.sessions.threads.retrieve,
  'sessions.archiveThread': (orca) => orca.sessions.threads.archive,
  'sessions.listThreadEvents': (orca) => orca.sessions.threads.events.list,
  'sessions.interruptThread': (orca) => orca.sessions.threads.interrupt,
  'sessions.streamThread': (orca) => orca.sessions.threads.events.stream,
  'skills.create': (orca) => orca.skills.create,
  'skills.list': (orca) => orca.skills.list,
  'skills.get': (orca) => orca.skills.retrieve,
  'skills.delete': (orca) => orca.skills.delete,
  'skills.createVersion': (orca) => orca.skills.versions.create,
  'skills.listVersions': (orca) => orca.skills.versions.list,
  'skills.getVersion': (orca) => orca.skills.versions.retrieve,
  'skills.deleteVersion': (orca) => orca.skills.versions.delete,
  'triggers.create': (orca) => orca.triggers.create,
  'triggers.list': (orca) => orca.triggers.list,
  'triggers.get': (orca) => orca.triggers.retrieve,
  'triggers.update': (orca) => orca.triggers.update,
  'triggers.delete': (orca) => orca.triggers.delete,
  'triggers.pause': (orca) => orca.triggers.pause,
  'triggers.sessions': (orca) => orca.triggers.sessions.list,
  'triggers.unpause': (orca) => orca.triggers.unpause,
  'vaults.create': (orca) => orca.vaults.create,
  'vaults.list': (orca) => orca.vaults.list,
  'vaults.get': (orca) => orca.vaults.retrieve,
  'vaults.update': (orca) => orca.vaults.update,
  'vaults.delete': (orca) => orca.vaults.delete,
  'vaults.archive': (orca) => orca.vaults.archive,
  'vaults.listCredentials': (orca) => orca.vaults.credentials.list,
  'vaults.createCredential': (orca) => orca.vaults.credentials.create,
  'vaults.getCredential': (orca) => orca.vaults.credentials.retrieve,
  'vaults.updateCredential': (orca) => orca.vaults.credentials.update,
  'vaults.deleteCredential': (orca) => orca.vaults.credentials.delete,
  'vaults.archiveCredential': (orca) => orca.vaults.credentials.archive,
  'vaults.mcpOauthValidateCredential': (orca) => orca.vaults.credentials.validate,
};

const excluded: Record<string, string> = {
  'discovery.coreVersions': 'Engine core discovery is outside the portable discovery surface.',
  'health.healthz': 'Deployment health probe, outside the SDK resource surface.',
  'health.readyz': 'Deployment readiness probe, outside the SDK resource surface.',
  'agents.delete': 'Unsupported by the portable deployment overlay; archive instead.',
  'gitCreds.resolveCreds': 'Internal worker credential exchange, outside the public SDK.',
  'gitProxy.uploadPack': 'Special JWT authentication and binary Git protocol are explicitly excluded.',
  'gitProxy.advertise': 'Special JWT authentication and binary Git protocol are explicitly excluded.',
  'outcomes.get': 'Engine-only outcome operation is outside the approved extras.',
  'skills.getVersionContent': 'Engine-only archive-content operation is outside the approved extras.',
};

describe('full public engine artifact classification', () => {
  const spec = readFileSync(resolve(__dirname, '../openapi/managed-agents-engine.yaml'), 'utf8');
  const operations = [...spec.matchAll(/^\s+operationId:\s+(\S+)$/gm)].map((m) => m[1]!);

  it('classifies all 114 operations exactly once', () => {
    expect(operations).toHaveLength(114);
    expect([...Object.keys(implemented), ...Object.keys(excluded)].sort()).toEqual(operations.sort());
    expect(Object.keys(implemented).filter((id) => id in excluded)).toEqual([]);
  });

  it('exposes every implemented operation as a callable public method', () => {
    const orca = new Orca({ baseURL: 'https://api.example.test' });
    for (const accessor of Object.values(implemented)) expect(typeof accessor(orca)).toBe('function');
    for (const reason of Object.values(excluded)) expect(reason.length).toBeGreaterThan(0);
  });
});
