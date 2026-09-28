// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Read an environment variable, trimming surrounding whitespace.
 *
 * Returns `undefined` when:
 *  - the variable is unset
 *  - the variable is set to an empty / whitespace-only string
 *  - the runtime does not expose `process` (browsers, some edge runtimes)
 */
export const readEnv = (name: string): string | undefined => {
  if (typeof process !== 'undefined') {
    const value = process.env?.[name]?.trim();
    return value ? value : undefined;
  }
  return undefined;
};
