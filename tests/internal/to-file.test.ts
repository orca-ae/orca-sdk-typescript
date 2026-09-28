// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { toFile } from '@runorca/orca-sdk/internal/to-file';

async function* makeAsyncIterable(chunks: string[]) {
  for (const chunk of chunks) {
    yield new TextEncoder().encode(chunk);
  }
}

describe('toFile', () => {
  it('converts a string to a File', async () => {
    const file = await toFile(new TextEncoder().encode('hello world'));
    expect(file).toBeInstanceOf(File);
    expect(await file.text()).toBe('hello world');
  });

  it('converts a Uint8Array to a File with correct size', async () => {
    const file = await toFile(new Uint8Array([1, 2, 3]));
    expect(file).toBeInstanceOf(File);
    expect(file.size).toBe(3);
  });

  it('extracts filename from content-disposition header on a Response', async () => {
    const response = new Response('content', {
      headers: { 'content-disposition': 'attachment; filename="x.txt"' },
    });
    // Response.url is empty for constructed responses, so we rely on name override
    const file = await toFile(response, 'x.txt');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('x.txt');
  });

  it('concatenates chunks from an async iterable', async () => {
    const iter = makeAsyncIterable(['a', 'b', 'c']);
    const file = await toFile(iter);
    expect(file).toBeInstanceOf(File);
    const text = await file.text();
    expect(text).toBe('abc');
  });

  it('honors the name override', async () => {
    const file = await toFile(new Uint8Array([0xff, 0x00]), 'override.bin');
    expect(file.name).toBe('override.bin');
    expect(file.size).toBe(2);
  });

  it('returns a File with the same content when no overrides given', async () => {
    const original = new File(['data'], 'original.txt', { type: 'text/plain' });
    const result = await toFile(original);
    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe('original.txt');
    expect(result.type).toBe('text/plain');
    expect(await result.text()).toBe('data');
  });

  it('wraps an existing File with a new name when name is supplied', async () => {
    const original = new File(['data'], 'original.txt', { type: 'text/plain' });
    const result = await toFile(original, 'renamed.txt');
    expect(result).not.toBe(original);
    expect(result.name).toBe('renamed.txt');
    expect(await result.text()).toBe('data');
  });

  it('does not throw when Response has no URL, and falls back to unknown_file', async () => {
    // A Response constructed without a URL has an empty url string, which previously
    // caused "Invalid URL" when passed to new URL(value.url).
    const file = await toFile(new Response('content'));
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('unknown_file');
  });

  it('infers MIME type from Blob parts when no type option is provided', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const file = await toFile(blob);
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('text/plain');
  });

  it('throws a clear error for an unsupported plain-object input', async () => {
    await expect(toFile({} as any)).rejects.toThrow('Unexpected data type');
  });

  it('resolves a PromiseLike input', async () => {
    const promise = Promise.resolve(new Uint8Array([10, 20]));
    const file = await toFile(promise);
    expect(file.size).toBe(2);
  });

  it('accepts a Blob', async () => {
    const blob = new Blob(['hello blob'], { type: 'text/plain' });
    const file = await toFile(blob, 'blob.txt');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('blob.txt');
    expect(await file.text()).toBe('hello blob');
  });
});
