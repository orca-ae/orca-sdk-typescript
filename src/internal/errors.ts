// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Small error helpers used by the request loop. The `OrcaError` hierarchy
 * lives in `core/error.ts`.
 */

/**
 * Returns true when the given value looks like a fetch `AbortError`.
 *
 * Accepts both the spec-compliant shape (`name === 'AbortError'`) and the
 * Expo/RN variant that surfaces via the error message.
 */
export function isAbortError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ('name' in err && (err as { name?: unknown }).name === 'AbortError') return true;
  if (
    'message' in err &&
    String((err as { message?: unknown }).message).includes('FetchRequestCanceledException')
  ) {
    return true;
  }
  return false;
}

/**
 * Coerces an unknown thrown value into a real `Error` instance, preserving
 * the original `name`, `cause`, and `stack` where possible.
 */
export function castToError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'object' && err !== null) {
    try {
      if (Object.prototype.toString.call(err) === '[object Error]') {
        const source = err as { message?: string; cause?: unknown; stack?: string; name?: string };
        const error = new Error(source.message, source.cause ? { cause: source.cause } : {});
        if (source.stack) error.stack = source.stack;
        if (source.cause && !(error as { cause?: unknown }).cause) {
          (error as { cause?: unknown }).cause = source.cause;
        }
        if (source.name) error.name = source.name;
        return error;
      }
    } catch {
      // Fall through to JSON-stringify path.
    }
    try {
      return new Error(JSON.stringify(err));
    } catch {
      // Fall through to default path.
    }
  }
  return new Error(String(err));
}
