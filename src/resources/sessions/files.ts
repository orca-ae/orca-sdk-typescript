// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { APIResource } from '../../core/resource';
import type { APIPromise } from '../../core/api-promise';
import { PageCursor, type PagePromise } from '../../core/pagination';
import { withDefaultAccept } from '../../internal/headers';
import type { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import type { FileMetadata } from '../files';

// ---- Session file types -----------------------------------------------------

/** Metadata for a file attached to a session. */
export type SessionFile = FileMetadata & {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export interface DeletedSessionFile {
  id: string;
  type: 'file_deleted';
}

export interface SessionFileListParams {
  limit?: number;
  after_id?: string;
  before_id?: string;
}

// ---- Resource class --------------------------------------------------------

/**
 * Files attached to a session. Both supported backends expose these
 * operations at the canonical `/v1/sessions/{id}/files` paths.
 */
export class SessionFiles extends APIResource {
  /**
   * List files attached to a session.
   *
   * @example
   * ```ts
   * const page = await orca.sessions.files.list('session_id');
   * for await (const file of orca.sessions.files.list('session_id')) { ... }
   * ```
   */
  list(
    sessionId: string,
    params: SessionFileListParams = {},
    options?: RequestOptions,
  ): PagePromise<PageCursor<SessionFile>, SessionFile> {
    return this._client.getAPIList(path`/v1/sessions/${sessionId}/files`, PageCursor<SessionFile>, {
      query: params,
      ...options,
    });
  }

  /**
   * Retrieve metadata for a session file.
   *
   * @example
   * ```ts
   * const file = await orca.sessions.files.retrieve('session_id', 'file_id');
   * ```
   */
  retrieve(sessionId: string, fileId: string, options?: RequestOptions): APIPromise<SessionFile> {
    return this._client.get(path`/v1/sessions/${sessionId}/files/${fileId}`, { ...options });
  }

  /**
   * Download the raw contents of a session file.
   *
   * @example
   * ```ts
   * const response = await orca.sessions.files.download('session_id', 'file_id');
   * const bytes = await response.arrayBuffer();
   * ```
   */
  download(sessionId: string, fileId: string, options?: RequestOptions): APIPromise<Response> {
    return this._client.get(path`/v1/sessions/${sessionId}/files/${fileId}/content`, {
      ...options,
      headers: withDefaultAccept(options?.headers, 'application/octet-stream'),
      __binaryResponse: true,
    });
  }

  /**
   * Delete a session file.
   *
   * @example
   * ```ts
   * await orca.sessions.files.delete('session_id', 'file_id');
   * ```
   */
  delete(sessionId: string, fileId: string, options?: RequestOptions): APIPromise<DeletedSessionFile> {
    return this._client.delete(path`/v1/sessions/${sessionId}/files/${fileId}`, options);
  }
}
