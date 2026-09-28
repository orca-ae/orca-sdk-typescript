// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Light-weight platform detection. We do not ship the granular
 * OS/arch/browser fingerprinting other SDKs use — a single
 * `X-Orca-Client` header is enough for diagnostics and avoids leaking
 * runtime details Orca does not need.
 */

import { SDK_VERSION } from './constants';

export const isRunningInBrowser = (): boolean => {
  return (
    // @ts-ignore - `document` only exists in browser-like environments.
    typeof document !== 'undefined' &&
    // @ts-ignore - `navigator` only exists in browser-like environments.
    typeof navigator !== 'undefined'
  );
};

/**
 * Returns the identifying headers we attach to every outgoing request.
 *
 * Kept intentionally minimal so the network surface remains predictable
 * regardless of which runtime the SDK is loaded in.
 */
export const getPlatformHeaders = (): Record<string, string> => {
  return {
    'X-Orca-Client': `orca-sdk-ts/${SDK_VERSION}`,
  };
};
