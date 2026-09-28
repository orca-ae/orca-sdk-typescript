// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Orca } from '../client';
import type { RequestOptions } from '../internal/request-options';

/** Defer an extension request until the deployment advertises its API group. */
export function extensionGate(
  client: Orca,
  group: string,
  options?: RequestOptions,
): Promise<RequestOptions> {
  return client.ensureExtensionAvailable(group, options).then(() => options ?? {});
}
