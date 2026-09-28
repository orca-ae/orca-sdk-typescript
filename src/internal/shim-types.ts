// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Re-export type-only shims. Most consumers only need `Fetch`; if/when more
 * shims (e.g. a cross-runtime `ReadableStream`) are needed they should be
 * added here without growing the runtime footprint of `shims.ts`.
 */

export type { Fetch } from './builtin-types';
