// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { APIError, ExtensionNotAvailableError, Orca, toFile } = require('../../dist');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const client = new Orca({
  apiKey: null,
  baseURL: requiredEnv('ORCA_BASE_URL'),
  defaultHeaders: { 'x-api-key': requiredEnv('ORCA_E2E_API_KEY') },
  maxRetries: 0,
});
const expectExecution = process.env.ORCA_E2E_EXPECT_EXECUTION === 'true';
const orcaBetaOptions = { headers: { 'orca-beta': 'managed-agents-2026-04-01' } };
const runSuffix = [
  process.env.GITHUB_RUN_ID ?? 'local',
  process.env.GITHUB_RUN_ATTEMPT ?? '0',
  process.pid,
].join('-');
const resourcePrefix = `sdk-e2e-${runSuffix}`;
const resources = {
  agent: undefined,
  environment: undefined,
  file: undefined,
  guardrail: undefined,
  session: undefined,
  trigger: undefined,
};

async function cleanupResources(strict) {
  const failures = [];
  const cleanup = async (name, operation) => {
    try {
      await operation();
    } catch (error) {
      failures.push(new Error(`${name}: ${error.message}`, { cause: error }));
    }
  };

  if (resources.trigger) {
    const trigger = resources.trigger;
    await cleanup('delete trigger', async () => {
      const deleted = await client.triggers.delete(trigger.id);
      assert.deepEqual(deleted, { id: trigger.id, type: 'trigger_deleted' });
      resources.trigger = undefined;
    });
  }
  if (resources.session) {
    const session = resources.session;
    await cleanup('archive session', async () => {
      const archived = await client.sessions.archive(session.id);
      assert.equal(archived.id, session.id);
      assert.ok(archived.archived_at, 'session archive did not set archived_at');
      resources.session = undefined;
    });
  }
  if (resources.agent) {
    const agent = resources.agent;
    if (resources.guardrail) {
      await cleanup('clear agent guardrails', async () => {
        const updated = await client.agents.update(agent.id, { guardrail_ids: null }, orcaBetaOptions);
        assert.deepEqual(updated.guardrail_ids, []);
      });
    }
    await cleanup('archive agent', async () => {
      const archived = await client.agents.archive(agent.id);
      assert.equal(archived.id, agent.id);
      resources.agent = undefined;
    });
  }
  if (resources.guardrail) {
    const guardrail = resources.guardrail;
    await cleanup('archive guardrail', async () => {
      const archived = await client.guardrails.archive(guardrail.id);
      assert.notEqual(archived.archived_at, null);
    });
    await cleanup('delete guardrail', async () => {
      const deleted = await client.guardrails.delete(guardrail.id);
      assert.deepEqual(deleted, { id: guardrail.id, type: 'guardrail_deleted' });
      resources.guardrail = undefined;
    });
  }
  if (resources.environment) {
    const environment = resources.environment;
    await cleanup('archive environment', async () => {
      const archived = await client.environments.archive(environment.id);
      assert.equal(archived.id, environment.id);
      resources.environment = undefined;
    });
  }
  if (resources.file) {
    const file = resources.file;
    await cleanup('delete file', async () => {
      const deleted = await client.files.delete(file.id);
      assert.deepEqual(deleted, { id: file.id, type: 'file_deleted' });
      resources.file = undefined;
    });
  }

  if (failures.length > 0) {
    if (strict) throw new AggregateError(failures, 'resource cleanup failed');
    for (const failure of failures) console.error('[CLEANUP FAIL]', failure);
  }
}

async function waitForAgentReply(sessionId, expectedReply) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const page = await client.sessions.events.list(sessionId, {
      limit: 1000,
      order: 'asc',
    });
    if (
      page.data.some(
        (event) => event.type === 'agent.message' && JSON.stringify(event).includes(expectedReply),
      )
    ) {
      return;
    }

    const terminalError = page.data.find((event) =>
      ['session.error', 'session.status_error', 'session.setup_failed'].includes(event.type),
    );
    if (terminalError) {
      throw new Error(
        `Managed Agents execution emitted ${terminalError.type}: ${JSON.stringify(terminalError)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`timed out waiting for deterministic reply: ${expectedReply}`);
}

async function assertSSEReplay(sessionId, expectedReply) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let found = false;
  try {
    const stream = await client.sessions.events.stream(
      sessionId,
      { from_cursor: '0' },
      { signal: controller.signal },
    );
    for await (const event of stream) {
      if (JSON.stringify(event).includes(expectedReply)) {
        found = true;
        break;
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  assert.equal(found, true, 'SSE replay did not include the deterministic reply');
}

test('SDK exercises the deployed topology through its public API', { timeout: 300_000 }, async () => {
  const failures = [];
  const runScenario = async (name, operation) => {
    console.log(`[RUN] ${name}`);
    try {
      await operation();
      console.log(`[PASS] ${name}`);
    } catch (error) {
      failures.push(new Error(`${name}: ${error.message}`, { cause: error }));
      console.error(`[FAIL] ${name}`, error);
    }
  };

  try {
    await runScenario('extension discovery matches the direct topology', async () => {
      const discovery = await client.discovery.groups();
      assert.equal(discovery.kind, 'APIGroupList');
      const hasCloud = discovery.groups.some((group) => group.name === 'cloud.sn.io');
      assert.equal(hasCloud, false);

      await assert.rejects(
        client.cloud.apiResources.list(),
        (error) => error instanceof ExtensionNotAvailableError && error.group === 'cloud.sn.io',
      );
    });

    await runScenario('policy and pricing extension discovery', async () => {
      const policyResources = await client.discovery.policyGroupResources();
      assert.equal(policyResources.group_version, 'policy.runorca.ai/v1');
      assert.ok(policyResources.resources.some((resource) => resource.name === 'guardrails'));
      assert.ok(policyResources.resources.some((resource) => resource.name === 'guardrailtypes'));

      const pricingResources = await client.discovery.pricingGroupResources();
      assert.equal(pricingResources.group_version, 'pricing.runorca.ai/v1');
      assert.ok(pricingResources.resources.some((resource) => resource.name === 'modelprices'));
    });

    await runScenario('guardrail create, list types, list, update, and retrieve', async () => {
      const types = await client.guardrails.listTypes();
      assert.ok(types.data.some((type) => type.name === 'block_tools'));

      resources.guardrail = await client.guardrails.create({
        name: `${resourcePrefix}-guardrail`,
        description: 'created by SDK E2E',
        phases: ['request'],
        scope: 'explicit',
        rule: { kind: 'expression', expression: 'true', on_false: 'deny' },
        metadata: { suite: 'orca-sdk-e2e' },
      });
      const updated = await client.guardrails.update(resources.guardrail.id, {
        description: 'updated by SDK E2E',
      });
      assert.equal(updated.description, 'updated by SDK E2E');
      const retrieved = await client.guardrails.retrieve(updated.id);
      assert.equal(retrieved.id, updated.id);
      const listed = await client.guardrails.list({ limit: 100 });
      assert.ok(listed.data.some((guardrail) => guardrail.id === updated.id));
    });

    await runScenario('model price list and retrieve', async () => {
      const prices = await client.modelPrices.list({ limit: 10 });
      assert.ok(prices.data.length > 0, 'seeded model price catalog is empty');
      const first = prices.data[0];
      const retrieved = await client.modelPrices.retrieve(first.model_id, {
        provider: first.provider,
      });
      assert.deepEqual(retrieved, first);
    });

    await runScenario('environment create, list, update, and retrieve', async () => {
      resources.environment = await client.environments.create({
        name: `${resourcePrefix}-environment`,
        description: 'created by SDK E2E',
        config: {
          type: 'cloud',
          networking: { type: 'unrestricted' },
        },
      });
      const updated = await client.environments.update(resources.environment.id, {
        description: 'updated by SDK E2E',
      });
      assert.equal(updated.description, 'updated by SDK E2E');
      const retrieved = await client.environments.retrieve(updated.id);
      assert.equal(retrieved.id, updated.id);
      const listed = await client.environments.list({ limit: 100 });
      assert.ok(listed.data.some((environment) => environment.id === updated.id));
    });

    await runScenario('agent create, list, update, and retrieve', async () => {
      resources.agent = await client.agents.create(
        {
          name: `${resourcePrefix}-agent`,
          model: {
            provider: 'anthropic',
            id: 'claude-sonnet-4-5-20250929',
          },
          system: 'Return concise answers.',
          metadata: { suite: 'orca-sdk-e2e' },
          ...(resources.guardrail ? { guardrail_ids: [resources.guardrail.id] } : {}),
        },
        resources.guardrail ? orcaBetaOptions : undefined,
      );
      const updated = await client.agents.update(
        resources.agent.id,
        { description: 'updated by SDK E2E' },
        resources.guardrail ? orcaBetaOptions : undefined,
      );
      assert.equal(updated.description, 'updated by SDK E2E');
      if (resources.guardrail) {
        assert.deepEqual(updated.guardrail_ids, [resources.guardrail.id]);
      }
      const retrieved = await client.agents.retrieve(
        updated.id,
        {},
        resources.guardrail ? orcaBetaOptions : undefined,
      );
      assert.equal(retrieved.id, updated.id);
      if (resources.guardrail) {
        assert.deepEqual(retrieved.guardrail_ids, [resources.guardrail.id]);
      }
      const listed = await client.agents.list(
        { limit: 100 },
        resources.guardrail ? orcaBetaOptions : undefined,
      );
      assert.ok(listed.data.some((agent) => agent.id === updated.id));
    });

    await runScenario('trigger create, list, update, actions, and session history', async () => {
      assert.ok(resources.agent, 'agent scenario did not create an agent');
      assert.ok(resources.environment, 'environment scenario did not create an environment');
      resources.trigger = await client.triggers.create({
        name: `${resourcePrefix}-trigger`,
        agent: {
          type: 'agent',
          id: resources.agent.id,
          version: resources.agent.version,
        },
        session_mode: 'SESSION_PER_EVENT',
        source: {
          type: 'cron',
          schedule: '0 0 1 1 *',
          timezone: 'Etc/UTC',
          payload: `SDK trigger ${runSuffix}`,
        },
        session: {
          environment_id: resources.environment.id,
          title_template: '${trigger.name}',
          metadata: { suite: 'orca-sdk-e2e' },
          vault_ids: [],
        },
        replicas: 1,
        paused: true,
      });
      assert.equal(resources.trigger.status, 'paused');

      const retrieved = await client.triggers.retrieve(resources.trigger.id);
      assert.equal(retrieved.id, resources.trigger.id);
      const updated = await client.triggers.update(resources.trigger.id, {
        name: `${resourcePrefix}-trigger-updated`,
        source: { type: 'cron', payload: `Updated SDK trigger ${runSuffix}` },
      });
      assert.equal(updated.name, `${resourcePrefix}-trigger-updated`);
      assert.equal(updated.source.payload, `Updated SDK trigger ${runSuffix}`);

      const listed = await client.triggers.list({
        agent_id: resources.agent.id,
        limit: 100,
      });
      assert.ok(listed.data.some((trigger) => trigger.id === resources.trigger.id));

      const sessions = await client.triggers.sessions.list(resources.trigger.id, { limit: 10 });
      assert.deepEqual(sessions.data, []);

      const active = await client.triggers.unpause(resources.trigger.id);
      assert.equal(active.status, 'active');
      const paused = await client.triggers.pause(resources.trigger.id);
      assert.equal(paused.status, 'paused');
      resources.trigger = paused;
    });

    await runScenario('file upload, list, retrieve, and denied download', async () => {
      const content = Buffer.from(`orca-sdk e2e file ${runSuffix}\n`);
      const file = await toFile(content, `${resourcePrefix}-upload.txt`, { type: 'text/plain' });
      resources.file = await client.files.upload({ file });
      const retrieved = await client.files.retrieve(resources.file.id);
      assert.equal(retrieved.id, resources.file.id);
      const listed = await client.files.list({ limit: 100 });
      assert.ok(listed.data.some((item) => item.id === resources.file.id));
      await assert.rejects(
        client.files.download(resources.file.id),
        (error) => error instanceof APIError && error.status === 403,
      );
    });

    await runScenario('session create, list, and retrieve', async () => {
      assert.ok(resources.agent, 'agent scenario did not create an agent');
      assert.ok(resources.environment, 'environment scenario did not create an environment');
      resources.session = await client.sessions.create(
        {
          agent: resources.guardrail
            ? {
                type: 'agent_with_overrides',
                id: resources.agent.id,
                guardrail_ids: [resources.guardrail.id],
              }
            : resources.agent.id,
          environment_id: resources.environment.id,
          title: `${resourcePrefix}-session`,
        },
        resources.guardrail ? orcaBetaOptions : undefined,
      );
      const retrieved = await client.sessions.retrieve(resources.session.id);
      assert.equal(retrieved.id, resources.session.id);
      const listed = await client.sessions.list({
        agent_id: resources.agent.id,
        limit: 100,
      });
      assert.ok(listed.data.some((session) => session.id === resources.session.id));
    });

    if (expectExecution) {
      await runScenario('deterministic execution and SSE replay', async () => {
        assert.ok(resources.session, 'session scenario did not create a session');
        const marker = `KIND_HELM_SDK_${runSuffix}`;
        const expectedReply = `MISSING_ECHO_TOOL ${marker}`;
        const sent = await client.sessions.events.send(resources.session.id, {
          events: [
            {
              type: 'user.message',
              content: [
                {
                  type: 'text',
                  text: `Return the deterministic marker ${marker}.`,
                },
              ],
            },
          ],
        });
        assert.equal(sent.data?.length, 1);
        await waitForAgentReply(resources.session.id, expectedReply);
        await assertSSEReplay(resources.session.id, expectedReply);
      });
    }

    await runScenario('resource archival and deletion', async () => {
      await cleanupResources(true);
    });
  } finally {
    await cleanupResources(false);
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} SDK E2E scenario(s) failed`);
  }
});
