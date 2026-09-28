// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import {
  makeFile,
  getName,
  isAsyncIterable,
  hasUploadableValue,
  maybeMultipartFormRequestOptions,
  multipartFormRequestOptionsPreservingFilePaths,
  createForm,
  addFormValue,
} from '@orca-ae/orca-sdk/internal/uploads';

// A minimal fetch function that the supportsFormData check will accept.
// It returns a real Response so the FormData-support detection can work.
const dummyFetch = Object.assign(async (..._: any[]): Promise<Response> => new Response(''), {
  Response,
});

async function* asyncGenerator() {
  yield 'a';
  yield 'b';
}

async function* byteGenerator() {
  yield new Uint8Array([1, 2, 3]);
}

describe('makeFile', () => {
  it('returns a File with the correct name and size', () => {
    const file = makeFile(['hello'], 'hello.txt');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('hello.txt');
    // 'hello' is 5 bytes (ASCII)
    expect(file.size).toBe(5);
  });

  it('uses unknown_file when name is undefined', () => {
    const file = makeFile(['x'], undefined);
    expect(file.name).toBe('unknown_file');
  });

  it('passes options through (type)', () => {
    const file = makeFile(['data'], 'data.json', { type: 'application/json' });
    expect(file.type).toBe('application/json');
  });
});

describe('getName', () => {
  it('returns name property directly', () => {
    expect(getName({ name: 'x.txt' }, true)).toBe('x.txt');
  });

  it('strips path component when stripPath is true', () => {
    expect(getName({ path: '/tmp/x.txt' }, true)).toBe('x.txt');
  });

  it('keeps full path when stripPath is false', () => {
    expect(getName({ path: '/tmp/x.txt' }, false)).toBe('/tmp/x.txt');
  });

  it('returns undefined for an empty name', () => {
    expect(getName({ name: '' }, true)).toBeUndefined();
  });

  it('falls back to url then filename then path in that order', () => {
    expect(getName({ url: 'https://example.com/file.pdf' }, true)).toBe('file.pdf');
    expect(getName({ filename: 'doc.pdf' }, true)).toBe('doc.pdf');
  });
});

describe('isAsyncIterable', () => {
  it('returns true for an async generator', () => {
    expect(isAsyncIterable(asyncGenerator())).toBe(true);
  });

  it('returns false for a plain array', () => {
    expect(isAsyncIterable([])).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isAsyncIterable('hello')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAsyncIterable(null)).toBe(false);
  });
});

describe('hasUploadableValue', () => {
  it('returns true for an object containing a File', () => {
    const obj = { attachment: new File(['x'], 'x.txt') };
    expect(hasUploadableValue(obj)).toBe(true);
  });

  it('returns false for plain JSON-compatible objects', () => {
    const obj = { name: 'foo', count: 42, nested: { ok: true } };
    expect(hasUploadableValue(obj)).toBe(false);
  });

  it('returns true for a File at the top level', () => {
    expect(hasUploadableValue(new File(['x'], 'x.txt'))).toBe(true);
  });

  it('returns true for a File inside an array', () => {
    expect(hasUploadableValue([new File(['x'], 'x.txt')])).toBe(true);
  });

  it('returns true when body contains a Response', () => {
    expect(hasUploadableValue(new Response('hello'))).toBe(true);
  });
});

describe('maybeMultipartFormRequestOptions', () => {
  it('returns opts unchanged when body has no uploadables', async () => {
    const opts = { method: 'post' as const, path: '/upload', body: { name: 'test', count: 3 } };
    const result = await maybeMultipartFormRequestOptions(opts, dummyFetch);
    expect(result).toBe(opts);
  });

  it('returns opts with FormData body when body contains a File', async () => {
    const opts = {
      method: 'post' as const,
      path: '/upload',
      body: { file: new File(['hello'], 'hello.txt'), label: 'doc' },
    };
    const result = await maybeMultipartFormRequestOptions(opts, dummyFetch);
    expect(result.body).toBeInstanceOf(FormData);
    const fd = result.body as FormData;
    expect(fd.get('label')).toBe('doc');
    const file = fd.get('file');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('hello.txt');
  });
});

describe('multipartFormRequestOptionsPreservingFilePaths', () => {
  it('preserves relative File paths while stripping inferred stream and response paths', async () => {
    const stream = Object.assign(byteGenerator(), { path: '/home/example/private/stream.txt' });
    const response = new Response('response');
    Object.defineProperty(response, 'url', {
      value: 'https://example.test/private/response.txt',
    });

    const result = await multipartFormRequestOptionsPreservingFilePaths(
      {
        body: {
          files: [new File(['skill'], 'test-skill/SKILL.md'), stream, response],
        },
      },
      dummyFetch,
    );
    const files = (result.body as FormData).getAll('files[]') as File[];

    expect(files.map((file) => file.name).sort()).toEqual([
      'response.txt',
      'stream.txt',
      'test-skill/SKILL.md',
    ]);
  });

  it('strips absolute and parent-traversing paths from explicit File names', async () => {
    const result = await multipartFormRequestOptionsPreservingFilePaths(
      {
        body: {
          files: [
            new File(['unix'], '/home/example/private/SKILL.md'),
            new File(['windows'], 'C:\\Users\\example\\private\\README.md'),
            new File(['parent'], '../private/reference.md'),
          ],
        },
      },
      dummyFetch,
    );
    const files = (result.body as FormData).getAll('files[]') as File[];

    expect(files.map((file) => file.name).sort()).toEqual(['README.md', 'SKILL.md', 'reference.md']);
  });
});

describe('createForm', () => {
  it('builds FormData with File and string entries', async () => {
    const form = await createForm(
      { file: new File(['x'], 'x.txt'), name: 'foo' },
      dummyFetch,
    );
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('name')).toBe('foo');
    const file = form.get('file');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('x.txt');
  });

  it('appends numeric values as strings', async () => {
    const form = await createForm({ count: 42 }, dummyFetch);
    expect(form.get('count')).toBe('42');
  });

  it('appends boolean values as strings', async () => {
    const form = await createForm({ flag: true }, dummyFetch);
    expect(form.get('flag')).toBe('true');
  });

  it('accepts an array of file values for a single key', async () => {
    const files = [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')];
    const form = await createForm({ attachments: files }, dummyFetch);
    // Arrays are appended with the key suffixed by []
    const entries = form.getAll('attachments[]');
    expect(entries).toHaveLength(2);
    expect((entries[0] as File).name).toBe('a.txt');
    expect((entries[1] as File).name).toBe('b.txt');
  });
});

describe('addFormValue', () => {
  it('flattens nested objects using bracket notation', async () => {
    const form = new FormData();
    await addFormValue(form, 'a', { b: 'c' }, false);
    // Nested key becomes a[b]
    expect(form.get('a[b]')).toBe('c');
  });
});
