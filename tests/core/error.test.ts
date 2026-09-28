// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import {
  OrcaError,
  APIError,
  APIUserAbortError,
  APIConnectionError,
  APIConnectionTimeoutError,
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  RateLimitError,
  InternalServerError,
} from '../../src/core/error';

const makeHeaders = (entries: Record<string, string> = {}): Headers => {
  const h = new Headers();
  for (const [k, v] of Object.entries(entries)) {
    h.set(k, v);
  }
  return h;
};

describe('APIError.generate', () => {
  it('400 → BadRequestError', () => {
    const err = APIError.generate(400, {}, 'bad request', makeHeaders());
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.status).toBe(400);
  });

  it('401 → AuthenticationError', () => {
    const err = APIError.generate(401, {}, 'unauthorized', makeHeaders());
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.status).toBe(401);
  });

  it('403 → PermissionDeniedError', () => {
    const err = APIError.generate(403, {}, 'forbidden', makeHeaders());
    expect(err).toBeInstanceOf(PermissionDeniedError);
    expect(err.status).toBe(403);
  });

  it('404 → NotFoundError', () => {
    const err = APIError.generate(404, {}, 'not found', makeHeaders());
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.status).toBe(404);
  });

  it('409 → ConflictError', () => {
    const err = APIError.generate(409, {}, 'conflict', makeHeaders());
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.status).toBe(409);
  });

  it('422 → UnprocessableEntityError', () => {
    const err = APIError.generate(422, {}, 'unprocessable', makeHeaders());
    expect(err).toBeInstanceOf(UnprocessableEntityError);
    expect(err.status).toBe(422);
  });

  it('429 → RateLimitError', () => {
    const err = APIError.generate(429, {}, 'rate limited', makeHeaders());
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.status).toBe(429);
  });

  it('500 → InternalServerError', () => {
    const err = APIError.generate(500, {}, 'server error', makeHeaders());
    expect(err).toBeInstanceOf(InternalServerError);
    expect(err.status).toBe(500);
  });

  it('503 → InternalServerError', () => {
    const err = APIError.generate(503, {}, 'service unavailable', makeHeaders());
    expect(err).toBeInstanceOf(InternalServerError);
    expect(err.status).toBe(503);
  });

  it('599 → InternalServerError', () => {
    const err = APIError.generate(599, {}, 'unknown server error', makeHeaders());
    expect(err).toBeInstanceOf(InternalServerError);
  });

  it('unknown status (418) → plain APIError', () => {
    const err = APIError.generate(418, {}, "I'm a teapot", makeHeaders());
    expect(err.constructor).toBe(APIError);
    expect(err.status).toBe(418);
  });

  it('undefined status → APIConnectionError with cause', () => {
    const body = new Error('network failure');
    const err = APIError.generate(undefined, body, 'connect failed', undefined);
    expect(err).toBeInstanceOf(APIConnectionError);
    expect((err as any).cause).toBe(body);
  });

  it('requestID is read from request-id header', () => {
    const headers = makeHeaders({ 'request-id': 'req_123' });
    const err = APIError.generate(400, {}, 'bad', headers);
    expect(err.requestID).toBe('req_123');
  });

  it('requestID is null when header is absent', () => {
    const err = APIError.generate(400, {}, 'bad', makeHeaders());
    expect(err.requestID).toBeNull();
  });
});

describe('APIUserAbortError', () => {
  it('has default abort message', () => {
    const err = new APIUserAbortError();
    expect(err.message).toBe('Request was aborted.');
  });

  it('accepts a custom message', () => {
    const err = new APIUserAbortError({ message: 'custom abort' });
    expect(err.message).toBe('custom abort');
  });
});

describe('APIConnectionTimeoutError', () => {
  it('has default timeout message', () => {
    const err = new APIConnectionTimeoutError();
    expect(err.message).toBe('Request timed out.');
  });

  it('accepts a custom message', () => {
    const err = new APIConnectionTimeoutError({ message: 'timed out early' });
    expect(err.message).toBe('timed out early');
  });
});

describe('instanceof chain', () => {
  it('OrcaError instanceof Error', () => {
    expect(new OrcaError('test')).toBeInstanceOf(Error);
  });

  it('APIError instanceof OrcaError', () => {
    const err = APIError.generate(400, {}, 'bad', makeHeaders());
    expect(err).toBeInstanceOf(OrcaError);
  });

  it('APIConnectionTimeoutError instanceof APIConnectionError', () => {
    expect(new APIConnectionTimeoutError()).toBeInstanceOf(APIConnectionError);
  });

  it('APIConnectionError instanceof APIError', () => {
    expect(new APIConnectionError({ message: 'fail' })).toBeInstanceOf(APIError);
  });
});
