// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

if (typeof globalThis.fetch !== 'function') {
  throw new Error('global fetch is required (Node >= 20)');
}
