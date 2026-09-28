// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { type RequestOptions } from './request-options';
import type { FilePropertyBag, Fetch } from './builtin-types';
import { ReadableStreamFrom } from './shims';

export type BlobPart = string | ArrayBuffer | ArrayBufferView | Blob | DataView;
type FsReadStream = AsyncIterable<Uint8Array> & { path: string | { toString(): string } };

// https://github.com/oven-sh/bun/issues/5980
interface BunFile extends Blob {
  readonly name?: string | undefined;
}

export const checkFileSupport = () => {
  if (typeof File === 'undefined') {
    const { process } = globalThis as any;
    const isOldNode =
      typeof process?.versions?.node === 'string' &&
      parseInt(process.versions.node.split('.')[0]!, 10) < 20;
    throw new Error(
      '`File` is not defined as a global, which is required for file uploads.' +
        (isOldNode ?
          " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`."
        : ''),
    );
  }
};

/**
 * Typically, this is a native "File" class.
 *
 * We provide the {@link toFile} utility to convert a variety of objects
 * into the File class.
 *
 * For convenience, you can also pass a fetch Response, or in Node,
 * the result of fs.createReadStream().
 */
export type Uploadable = File | Response | FsReadStream | BunFile;

/**
 * Construct a `File` instance. This is used to ensure a helpful error is
 * thrown for environments that don't define a global `File` yet.
 */
export function makeFile(
  fileBits: BlobPart[],
  fileName: string | undefined,
  options?: FilePropertyBag,
): File {
  checkFileSupport();
  return new File(fileBits as any, fileName ?? 'unknown_file', options);
}

export function getName(value: any, stripPath: boolean): string | undefined {
  const val =
    (typeof value === 'object' &&
      value !== null &&
      (('name' in value && value.name && String(value.name)) ||
        ('url' in value && value.url && String(value.url)) ||
        ('filename' in value && value.filename && String(value.filename)) ||
        ('path' in value && value.path && String(value.path)))) ||
    '';

  return stripPath ? val.split(/[\\/]/).pop() || undefined : val;
}

export const isAsyncIterable = (value: any): value is AsyncIterable<any> =>
  value != null && typeof value === 'object' && typeof value[Symbol.asyncIterator] === 'function';

/**
 * Returns a multipart/form-data request if any part of the given request body
 * contains a File / Blob value. Otherwise returns the request as is.
 */
export const maybeMultipartFormRequestOptions = async (
  opts: RequestOptions,
  fetch: any,
): Promise<RequestOptions> => {
  if (!hasUploadableValue(opts.body)) return opts;

  return { ...opts, body: await createForm(opts.body, fetch) };
};

type MultipartFormRequestOptions = Omit<RequestOptions, 'body'> & { body: unknown };
type MultipartFilenamePolicy = 'strip' | 'preserve' | 'preserve-relative-file-paths';

export const multipartFormRequestOptions = async (
  opts: MultipartFormRequestOptions,
  fetch: any,
  stripFilenames: boolean = true,
): Promise<RequestOptions> => {
  return {
    ...opts,
    body: await createFormWithFilenamePolicy(
      opts.body,
      fetch,
      stripFilenames ? 'strip' : 'preserve',
    ),
  };
};

/**
 * Preserve safe bundle-relative paths from explicitly named files while still
 * basename-normalizing names inferred from response URLs and stream paths.
 */
export const multipartFormRequestOptionsPreservingFilePaths = async (
  opts: MultipartFormRequestOptions,
  fetch: any,
): Promise<RequestOptions> => {
  return {
    ...opts,
    body: await createFormWithFilenamePolicy(opts.body, fetch, 'preserve-relative-file-paths'),
  };
};

const supportsFormDataMap = /* @__PURE__ */ new WeakMap<Fetch, Promise<boolean>>();

/**
 * node-fetch doesn't support the global FormData object in recent node versions.
 * Instead of sending properly-encoded form data, it just stringifies the object,
 * resulting in a request body of "[object FormData]". This function detects if
 * the fetch function provided supports the global FormData object to avoid
 * confusing error messages later on.
 */
function supportsFormData(fetchObject: any): Promise<boolean> {
  const fetchFn: Fetch = typeof fetchObject === 'function' ? fetchObject : fetchObject.fetch;
  const cached = supportsFormDataMap.get(fetchFn);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const FetchResponse = (
        'Response' in fetchFn ?
          (fetchFn as any).Response
        : (await fetchFn('data:,')).constructor) as typeof Response;
      const data = new FormData();
      if (data.toString() === (await new FetchResponse(data).text())) {
        return false;
      }
      return true;
    } catch {
      // avoid false negatives
      return true;
    }
  })();
  supportsFormDataMap.set(fetchFn, promise);
  return promise;
}

export const createForm = async <T = Record<string, unknown>>(
  body: T | undefined,
  fetch: any,
  stripFilenames: boolean = true,
): Promise<FormData> => {
  return createFormWithFilenamePolicy(body, fetch, stripFilenames ? 'strip' : 'preserve');
};

const createFormWithFilenamePolicy = async <T = Record<string, unknown>>(
  body: T | undefined,
  fetch: any,
  filenamePolicy: MultipartFilenamePolicy,
): Promise<FormData> => {
  if (!(await supportsFormData(fetch))) {
    throw new TypeError(
      'The provided fetch function does not support file uploads with the current global FormData class.',
    );
  }
  const form = new FormData();
  await Promise.all(
    Object.entries(body || {}).map(([key, value]) =>
      addFormValueWithFilenamePolicy(form, key, value, filenamePolicy),
    ),
  );
  return form;
};

// We check for Blob not File because Bun.File doesn't inherit from File,
// but they both inherit from Blob and have a `name` property at runtime.
const isNamedBlob = (value: unknown): value is Blob => value instanceof Blob && 'name' in value;

const isUploadable = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  (value instanceof Response || isAsyncIterable(value) || isNamedBlob(value));

export const hasUploadableValue = (value: unknown): boolean => {
  if (isUploadable(value)) return true;
  if (Array.isArray(value)) return value.some(hasUploadableValue);
  if (value && typeof value === 'object') {
    for (const k in value) {
      if (hasUploadableValue((value as any)[k])) return true;
    }
  }
  return false;
};

export const addFormValue = async (
  form: FormData,
  key: string,
  value: unknown,
  stripFilenames: boolean,
): Promise<void> => {
  return addFormValueWithFilenamePolicy(
    form,
    key,
    value,
    stripFilenames ? 'strip' : 'preserve',
  );
};

const addFormValueWithFilenamePolicy = async (
  form: FormData,
  key: string,
  value: unknown,
  filenamePolicy: MultipartFilenamePolicy,
): Promise<void> => {
  if (value === undefined) return;
  if (value == null) {
    throw new TypeError(
      `Received null for "${key}"; to pass null in FormData, you must use the string 'null'`,
    );
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    form.append(key, String(value));
  } else if (value instanceof Response) {
    let options = {} as FilePropertyBag;
    const contentType = value.headers.get('Content-Type');
    if (contentType) {
      options = { type: contentType };
    }

    form.append(key, makeFile([await value.blob()], multipartFilename(value, filenamePolicy), options));
  } else if (isAsyncIterable(value)) {
    form.append(
      key,
      makeFile(
        [await new Response(ReadableStreamFrom(value)).blob()],
        multipartFilename(value, filenamePolicy),
      ),
    );
  } else if (isNamedBlob(value)) {
    form.append(key, makeFile([value], multipartFilename(value, filenamePolicy), { type: value.type }));
  } else if (Array.isArray(value)) {
    await Promise.all(
      value.map((entry) => addFormValueWithFilenamePolicy(form, key + '[]', entry, filenamePolicy)),
    );
  } else if (typeof value === 'object') {
    await Promise.all(
      Object.entries(value).map(([name, prop]) =>
        addFormValueWithFilenamePolicy(form, `${key}[${name}]`, prop, filenamePolicy),
      ),
    );
  } else {
    throw new TypeError(
      `Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`,
    );
  }
};

function multipartFilename(
  value: unknown,
  filenamePolicy: MultipartFilenamePolicy,
): string | undefined {
  if (filenamePolicy === 'preserve') return getName(value, false);
  if (filenamePolicy === 'preserve-relative-file-paths' && isNamedBlob(value)) {
    const name = getName(value, false);
    if (name && isBundleRelativePath(name)) return name;
  }
  return getName(value, true);
}

function isBundleRelativePath(name: string): boolean {
  if (/^(?:[\\/]|[A-Za-z]:|[A-Za-z][A-Za-z0-9+.-]*:)/.test(name)) return false;
  return !name.split(/[\\/]/).some((segment) => segment === '..');
}
