// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Constants shared across the internal layer.
 */

import { VERSION } from '../version';

export const SDK_VERSION = VERSION;

/**
 * Default `User-Agent` prefix sent on outgoing requests. The Orca client
 * appends the runtime version (e.g. `node/20.10.0`) before the request goes
 * out.
 */
export const DEFAULT_USER_AGENT_PREFIX = `orca-sdk-ts/${SDK_VERSION}`;

/**
 * The extension API group `orca.cloud.*` targets, exactly as advertised by
 * `GET /apis`. Single source of truth: `resources/cloud/gate.ts` gates
 * every `orca.cloud.*` call on this constant (via the generic
 * `BaseOrca.ensureExtensionAvailable(group)`) instead of repeating the
 * literal in each resource file.
 */
export const CLOUD_EXTENSION_GROUP = 'cloud.sn.io';

/** Extension group that serves guardrail policy resources. */
export const POLICY_EXTENSION_GROUP = 'policy.runorca.ai';

/** Extension group that serves effective model prices. */
export const PRICING_EXTENSION_GROUP = 'pricing.runorca.ai';
