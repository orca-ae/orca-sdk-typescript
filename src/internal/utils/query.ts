// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Minimal query-string encoder.
 *
 * Orca's API surface does not currently use nested query parameters, so the
 * builtin `URLSearchParams` is sufficient. Should that change, this is the
 * only file that needs to grow a richer encoder.
 *
 * Behaviour:
 *  - `null`/`undefined` values are skipped entirely.
 *  - Array values produce repeated keys (`?tags=a&tags=b`).
 *  - All other values are coerced via `String(...)`.
 */
export const stringifyQuery = (query: Record<string, unknown> | undefined): string => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null) continue;
        params.append(key, String(item));
      }
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
};
