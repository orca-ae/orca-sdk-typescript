// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import {
  ensurePresent,
  hasOwn,
  isAbsoluteURL,
  isEmptyObj,
  isObj,
  pop,
  safeJSON,
  validatePositiveInteger,
} from '@runorca/orca-sdk/internal/utils/values';

describe('safeJSON', () => {
  it('parses valid JSON', () => {
    expect(safeJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns undefined on bad input', () => {
    expect(safeJSON('not-json')).toBeUndefined();
    expect(safeJSON('')).toBeUndefined();
  });
});

describe('validatePositiveInteger', () => {
  it('accepts zero and positive integers', () => {
    expect(validatePositiveInteger('n', 0)).toBe(0);
    expect(validatePositiveInteger('n', 42)).toBe(42);
  });

  it('rejects non-integers', () => {
    expect(() => validatePositiveInteger('limit', 1.5)).toThrow(/must be an integer/);
    expect(() => validatePositiveInteger('limit', '10' as unknown as number)).toThrow(/must be an integer/);
  });

  it('rejects negative integers', () => {
    expect(() => validatePositiveInteger('limit', -1)).toThrow(/must be a positive integer/);
  });
});

describe('isAbsoluteURL', () => {
  it('matches http and https URLs', () => {
    expect(isAbsoluteURL('http://example.com')).toBe(true);
    expect(isAbsoluteURL('https://example.com')).toBe(true);
  });

  it('matches other URL schemes', () => {
    expect(isAbsoluteURL('ws://example.com')).toBe(true);
    expect(isAbsoluteURL('custom-scheme:foo')).toBe(true);
  });

  it('rejects relative paths', () => {
    expect(isAbsoluteURL('/v1/agents')).toBe(false);
    expect(isAbsoluteURL('agents')).toBe(false);
    expect(isAbsoluteURL('//cdn.example.com')).toBe(false);
  });
});

describe('object helpers', () => {
  it('isObj distinguishes records from arrays and primitives', () => {
    expect(isObj({})).toBe(true);
    expect(isObj([])).toBe(false);
    expect(isObj(null)).toBe(false);
    expect(isObj('s')).toBe(false);
  });

  it('isEmptyObj returns true for null/undefined and empty objects', () => {
    expect(isEmptyObj(null)).toBe(true);
    expect(isEmptyObj(undefined)).toBe(true);
    expect(isEmptyObj({})).toBe(true);
    expect(isEmptyObj({ a: 1 })).toBe(false);
  });

  it('hasOwn ignores prototype keys', () => {
    expect(hasOwn({ a: 1 }, 'a')).toBe(true);
    expect(hasOwn({}, 'toString')).toBe(false);
  });

  it('pop removes and returns the value', () => {
    const obj: Record<string, number> = { a: 1, b: 2 };
    expect(pop(obj, 'a')).toBe(1);
    expect('a' in obj).toBe(false);
  });
});

describe('ensurePresent', () => {
  it('returns the value when present', () => {
    expect(ensurePresent('x')).toBe('x');
    expect(ensurePresent(0)).toBe(0);
  });

  it('throws for null and undefined', () => {
    expect(() => ensurePresent(null)).toThrow();
    expect(() => ensurePresent(undefined)).toThrow();
  });
});
