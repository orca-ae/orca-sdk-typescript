// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

export const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
