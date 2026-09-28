// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { stringifyQuery } from '@orca-ae/orca-sdk/internal/utils/query';

describe('stringifyQuery', () => {
  it('returns an empty string for undefined input', () => {
    expect(stringifyQuery(undefined)).toBe('');
  });

  it('returns an empty string for an empty object', () => {
    expect(stringifyQuery({})).toBe('');
  });

  it('encodes a single key', () => {
    expect(stringifyQuery({ status: 'active' })).toBe('status=active');
  });

  it('repeats keys for array values', () => {
    expect(stringifyQuery({ tags: ['a', 'b'] })).toBe('tags=a&tags=b');
  });

  it('skips null and undefined values entirely', () => {
    expect(stringifyQuery({ a: 'x', b: null, c: undefined })).toBe('a=x');
  });

  it('skips null/undefined entries inside arrays', () => {
    expect(stringifyQuery({ tags: ['a', null, 'b', undefined] })).toBe('tags=a&tags=b');
  });

  it('encodes special characters', () => {
    expect(stringifyQuery({ q: 'hello world & co' })).toBe('q=hello+world+%26+co');
  });

  it('coerces numbers and booleans to strings', () => {
    expect(stringifyQuery({ limit: 10, archived: false })).toBe('limit=10&archived=false');
  });
});
