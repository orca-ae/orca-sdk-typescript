// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { buildHeaders, isEmptyHeaders } from '@runorca/orca-sdk/internal/headers';

describe('buildHeaders', () => {
  it('builds from a plain object', () => {
    const result = buildHeaders([{ 'X-Foo': 'bar', 'X-Baz': 'qux' }]);
    expect(result.values.get('x-foo')).toBe('bar');
    expect(result.values.get('x-baz')).toBe('qux');
    expect(result.nulls.size).toBe(0);
  });

  it('builds from a Headers instance', () => {
    const headers = new Headers({ 'X-One': '1' });
    headers.append('X-Two', '2');
    const result = buildHeaders([headers]);
    expect(result.values.get('x-one')).toBe('1');
    expect(result.values.get('x-two')).toBe('2');
  });

  it('object values overwrite (replace) prior entries', () => {
    const result = buildHeaders([{ 'X-Foo': 'first' }, { 'X-Foo': 'second' }]);
    expect(result.values.get('x-foo')).toBe('second');
  });

  it('appends multiple values from a single tuple-array source', () => {
    const result = buildHeaders([
      [
        ['x-multi', 'one'],
        ['x-multi', 'two'],
      ],
    ]);
    expect(result.values.get('x-multi')).toBe('one, two');
  });

  it('a later Headers entry replaces an earlier one for the same name', () => {
    const a = new Headers();
    a.append('X-Append', '1');
    const b = new Headers();
    b.append('X-Append', '2');
    const result = buildHeaders([a, b]);
    expect(result.values.get('x-append')).toBe('2');
  });

  it('null values clear a header and remember the deletion', () => {
    const result = buildHeaders([{ 'X-Foo': 'bar' }, { 'X-Foo': null }]);
    expect(result.values.get('x-foo')).toBeNull();
    expect(result.nulls.has('x-foo')).toBe(true);
  });

  it('merges multiple HeadersLike with later entries winning', () => {
    const result = buildHeaders([
      { 'X-One': '1', 'X-Two': '2' },
      { 'X-Two': 'updated' },
      [['x-three', '3']],
    ]);
    expect(result.values.get('x-one')).toBe('1');
    expect(result.values.get('x-two')).toBe('updated');
    expect(result.values.get('x-three')).toBe('3');
  });

  it('treats header names case-insensitively', () => {
    const result = buildHeaders([{ 'x-foo': 'one' }, { 'X-FOO': 'two' }]);
    expect(result.values.get('x-foo')).toBe('two');
  });

  it('round-trips a previously-built NullableHeaders preserving cleared names', () => {
    const first = buildHeaders([{ 'X-Foo': 'bar' }, { 'X-Foo': null }]);
    const result = buildHeaders([first, { 'X-Other': 'value' }]);
    expect(result.values.get('x-foo')).toBeNull();
    expect(result.nulls.has('x-foo')).toBe(true);
    expect(result.values.get('x-other')).toBe('value');
  });
});

describe('isEmptyHeaders', () => {
  it('returns true for null/undefined/empty inputs', () => {
    expect(isEmptyHeaders(null)).toBe(true);
    expect(isEmptyHeaders(undefined)).toBe(true);
    expect(isEmptyHeaders({})).toBe(true);
    expect(isEmptyHeaders([])).toBe(true);
  });

  it('returns false when any entry is present', () => {
    expect(isEmptyHeaders({ 'x-foo': 'bar' })).toBe(false);
  });
});
