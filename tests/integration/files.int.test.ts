// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests — Files resource.
 *
 * upload → list (assert presence) → retrieve → delete.
 * All tests are gated on ORCA_TEST_API_KEY being present.
 */

import {
  describeIfCredentials,
  getTestClient,
  getTestPrefix,
} from './setup';
import { toFile } from '@orca-ae/orca-sdk';
import type { FileMetadata, Orca } from '@orca-ae/orca-sdk';

describeIfCredentials('Files (integration)', () => {
  let client: Orca;
  let prefix: string;
  let uploadedFileId: string;

  beforeAll(() => {
    client = getTestClient();
    prefix = getTestPrefix();
  });

  afterAll(async () => {
    if (uploadedFileId) {
      try {
        await client.files.delete(uploadedFileId);
      } catch {
        // best-effort
      }
    }
  });

  test('upload — returns file metadata with an id', async () => {
    const content = new Blob(['hello integration test'], { type: 'text/plain' });
    const file = await toFile(content, `${prefix}-hi.txt`, {
      type: 'text/plain',
    });

    const meta: FileMetadata = await client.files.upload({ file });

    expect(meta.id).toBeTruthy();
    uploadedFileId = meta.id;
  });

  test('list — uploaded file appears in listing', async () => {
    const items: FileMetadata[] = [];
    for await (const f of client.files.list()) {
      if (f.id === uploadedFileId) items.push(f);
    }
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('retrieve — fetches the file metadata by id', async () => {
    const meta = await client.files.retrieve(uploadedFileId);
    expect(meta.id).toBe(uploadedFileId);
  });

  test('download — fetches the uploaded file content', async () => {
    const response = await client.files.download(uploadedFileId);
    expect(response).toBeInstanceOf(Response);
    expect(await response.text()).toBe('hello integration test');
  });

  test('delete — removes the file', async () => {
    const deleted = await client.files.delete(uploadedFileId);
    expect(deleted).toEqual({ id: uploadedFileId, type: 'file_deleted' });
    // Clear so afterAll doesn't double-delete.
    uploadedFileId = '';
  });
});
