#!/usr/bin/env -S npm run tsn -T
// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * File upload example.
 *
 * Uploads a small in-memory file, lists files (first page), then deletes the
 * uploaded file.
 *
 * Required environment variables:
 *   ORCA_API_KEY  — Bearer token for the Orca API
 *   ORCA_BASE_URL — Base URL, e.g. https://api.orca.example
 */

import Orca, { OrcaError } from '@orca-ae/orca-sdk';

async function main(): Promise<void> {
  const orca = new Orca({
    apiKey: process.env['ORCA_API_KEY'],
    baseURL: process.env['ORCA_BASE_URL'],
  });

  // Upload a small in-memory file
  console.log('Uploading file...');
  const file = new File(['hello\n'], 'demo.txt', { type: 'text/plain' });
  const meta = await orca.files.upload({ file });
  console.log('Uploaded file metadata:', JSON.stringify(meta, null, 2));

  // List files — first page only
  console.log('\nListing files (first page)...');
  const page = await orca.files.list({ limit: 10 });
  for (const f of page.data) {
    console.log(' -', JSON.stringify(f));
  }

  // Delete the uploaded file
  const fileId = meta.id;
  console.log('\nDeleting file', fileId, '...');
  await orca.files.delete(fileId);
  console.log('File deleted.');

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  if (err instanceof OrcaError) {
    console.error('OrcaError:', err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
