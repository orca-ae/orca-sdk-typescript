// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { path } from '@runorca/orca-sdk/internal/utils/path';

describe('path template tag', () => {
  it('encodes a simple substitution', () => {
    expect(path`/v1/agents/${'agent-1'}`).toBe('/v1/agents/agent-1');
  });

  it('encodes special characters', () => {
    expect(path`/v1/agents/${'has space & slash/'}`).toBe('/v1/agents/has%20space%20%26%20slash%2F');
  });

  it('handles multiple substitutions in order', () => {
    expect(path`/v1/agents/${'a-1'}/sessions/${'s-2'}`).toBe('/v1/agents/a-1/sessions/s-2');
  });

  it('coerces numeric segments to strings', () => {
    expect(path`/v1/agents/${42}`).toBe('/v1/agents/42');
  });

  it('returns the static prefix verbatim when there are no substitutions', () => {
    expect(path`/v1/health`).toBe('/v1/health');
  });
});
