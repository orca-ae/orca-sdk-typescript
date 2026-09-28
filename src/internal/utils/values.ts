// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Value-shape helpers used across the internal layer.
 */

import { OrcaError } from '../../core/error';

// https://url.spec.whatwg.org/#url-scheme-string
const startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;

export const isAbsoluteURL = (url: string): boolean => {
  return startsWithSchemeRegexp.test(url);
};

// Self-rebinding pattern keeps the lazy `Array.isArray` lookup cheap while
// preserving a `val is unknown[]` type predicate.
export let isArray = (val: unknown): val is unknown[] => ((isArray = Array.isArray), isArray(val));
export let isReadonlyArray = isArray as (val: unknown) => val is readonly unknown[];

/** Returns `{}` if the given value isn't an object, otherwise returns it as-is. */
export function maybeObj(x: unknown): object {
  if (typeof x !== 'object') {
    return {};
  }
  return x ?? {};
}

// https://stackoverflow.com/a/34491287
export function isEmptyObj(obj: Object | null | undefined): boolean {
  if (!obj) return true;
  for (const _k in obj) return false;
  return true;
}

// https://eslint.org/docs/latest/rules/no-prototype-builtins
export function hasOwn<T extends object = object>(obj: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isObj(obj: unknown): obj is Record<string, unknown> {
  return obj != null && typeof obj === 'object' && !Array.isArray(obj);
}

export const ensurePresent = <T>(value: T | null | undefined): T => {
  if (value == null) {
    throw new OrcaError(`Expected a value to be given but received ${value} instead.`);
  }
  return value;
};

export const validatePositiveInteger = (name: string, n: unknown): number => {
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new OrcaError(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new OrcaError(`${name} must be a positive integer`);
  }
  return n;
};

export const safeJSON = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Gets a value from an object, deletes the key, and returns the value (or undefined if not found). */
export const pop = <T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): T[K] => {
  const value = obj[key];
  delete obj[key];
  return value;
};
