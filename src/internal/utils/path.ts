// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Template tag for safely interpolating user-supplied values into URL paths.
 *
 *   path`/v1/agents/${agentId}/sessions/${sessionId}`
 *
 * Each substitution is `encodeURIComponent`-encoded. The static segments are
 * preserved verbatim so callers control where literal `/` separators go.
 */
export const path = (strings: TemplateStringsArray, ...values: (string | number)[]): string => {
  let out = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) {
    out += encodeURIComponent(String(values[i])) + (strings[i + 1] ?? '');
  }
  return out;
};
