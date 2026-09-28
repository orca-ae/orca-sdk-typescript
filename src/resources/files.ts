// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { PageCursor, type PagePromise } from '../core/pagination';
import { withDefaultAccept } from '../internal/headers';
import type { RequestOptions } from '../internal/request-options';
import { path } from '../internal/utils/path';
import { type Uploadable, multipartFormRequestOptions } from '../internal/uploads';

// ---- File metadata response type ---------------------------------------------

export interface SessionScopedFileMetadata {
  id: string;
  created_at: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  type: 'file';
  downloadable?: boolean;
  scope?: { type: 'session'; id: string } | null;
}

export interface AgentFileMetadata {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  metadata?: Record<string, string>;
  purpose: 'agent' | 'agent_output';
  scope_id: string | null;
  downloadable: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FileMetadata = SessionScopedFileMetadata | AgentFileMetadata;

export interface DeletedFile {
  id: string;
  type: 'file_deleted';
}

// ---- Request parameter types -------------------------------------------------

export interface FileUploadParams {
  /** The file to upload. Use {@link toFile} to convert local paths or streams. */
  file: Uploadable;
}

export interface FileListParams {
  limit?: number;
  after_id?: string;
  before_id?: string;
}

// ---- Resource class ----------------------------------------------------------

export class Files extends APIResource {
  /**
   * Upload a file using multipart/form-data.
   *
   * @example
   * ```ts
   * const meta = await orca.files.upload({ file: myFile });
   * ```
   */
  upload(params: FileUploadParams, options?: RequestOptions): APIPromise<FileMetadata> {
    return this._client.post(
      '/v1/files',
      multipartFormRequestOptions({ body: params, ...options }, this._client),
    );
  }

  /**
   * Retrieve metadata for a stored file.
   *
   * @example
   * ```ts
   * const meta = await orca.files.retrieve('file_id');
   * ```
   */
  retrieve(fileId: string, options?: RequestOptions): APIPromise<FileMetadata> {
    return this._client.get(path`/v1/files/${fileId}`, { ...options });
  }

  /**
   * Download the raw contents of a stored file.
   *
   * @example
   * ```ts
   * const response = await orca.files.download('file_id');
   * const bytes = await response.arrayBuffer();
   * ```
   */
  download(fileId: string, options?: RequestOptions): APIPromise<Response> {
    return this._client.get(path`/v1/files/${fileId}/content`, {
      ...options,
      headers: withDefaultAccept(options?.headers, 'application/octet-stream'),
      __binaryResponse: true,
    });
  }

  /**
   * List uploaded files.
   *
   * @example
   * ```ts
   * const page = await orca.files.list();
   * for await (const file of orca.files.list()) { ... }
   * ```
   */
  list(
    params: FileListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<FileMetadata>, FileMetadata> {
    return this._client.getAPIList('/v1/files', PageCursor<FileMetadata>, {
      query: params,
      ...options,
    });
  }

  /**
   * Permanently delete a stored file and return its tombstone.
   *
   * @example
   * ```ts
   * const deleted = await orca.files.delete('file_id');
   * ```
   */
  delete(fileId: string, options?: RequestOptions): APIPromise<DeletedFile> {
    return this._client.delete(path`/v1/files/${fileId}`, { ...options });
  }
}
