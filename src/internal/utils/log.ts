// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Logging primitives used by the request pipeline.
 *
 * `loggerFor` returns a leveled wrapper that no-ops calls below the
 * configured level. The Orca client routes every request, retry, and error
 * log through it.
 */

import { type RequestOptions } from '../request-options';
import { hasOwn } from './values';

type LogFn = (message: string, ...rest: unknown[]) => void;

export type Logger = {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
};

export type LeveledLogger = Logger;

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Minimal contract a client must satisfy to be passed into `loggerFor`. We
 * deliberately avoid importing the Orca client here so this module doesn't
 * depend on it.
 */
export interface LoggableClient {
  logger?: Logger | undefined;
  logLevel?: LogLevel | undefined;
}

const levelNumbers: Record<LogLevel, number> = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500,
};

export const parseLogLevel = (
  maybeLevel: string | undefined,
  sourceName: string,
  client: LoggableClient,
): LogLevel | undefined => {
  if (!maybeLevel) {
    return undefined;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel as LogLevel;
  }
  loggerFor(client).warn(
    `${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(
      Object.keys(levelNumbers),
    )}`,
  );
  return undefined;
};

function noop(): void {}

function makeLogFn(fnLevel: keyof Logger, logger: Logger | undefined, logLevel: LogLevel): LogFn {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  }
  // Don't wrap logger methods, we want the stacktrace intact!
  return logger[fnLevel].bind(logger);
}

const noopLogger: Logger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
};

const cachedLoggers = /* @__PURE__ */ new WeakMap<Logger, [LogLevel, Logger]>();

export function loggerFor(client: LoggableClient): LeveledLogger {
  const logger = client.logger;
  const logLevel = client.logLevel ?? 'off';
  if (!logger) {
    return noopLogger;
  }

  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }

  const levelLogger: Logger = {
    error: makeLogFn('error', logger, logLevel),
    warn: makeLogFn('warn', logger, logLevel),
    info: makeLogFn('info', logger, logLevel),
    debug: makeLogFn('debug', logger, logLevel),
  };

  cachedLoggers.set(logger, [logLevel, levelLogger]);

  return levelLogger;
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'api-key',
  'x-api-key',
  'cookie',
  'set-cookie',
]);

/**
 * Returns a debug-friendly snapshot of a request. Sensitive headers are
 * redacted so logs can be safely captured at the `debug` level.
 */
export const formatRequestDetails = (details: {
  options?: RequestOptions | undefined;
  headers?: Headers | Record<string, string> | undefined;
  retryOfRequestLogID?: string | undefined;
  retryOf?: string | undefined;
  url?: string | undefined;
  status?: number | undefined;
  method?: string | undefined;
  durationMs?: number | undefined;
  message?: unknown;
  body?: unknown;
}): unknown => {
  details = { ...details };
  if (details.options) {
    details.options = { ...details.options };
    // Headers are logged separately (and redacted); drop the duplicate copy.
    delete details.options['headers'];
  }
  if (details.headers) {
    const entries =
      details.headers instanceof Headers ?
        [...details.headers]
      : Object.entries(details.headers);
    details.headers = Object.fromEntries(
      entries.map(([name, value]) => [
        name,
        SENSITIVE_HEADERS.has(name.toLowerCase()) ? '***' : value,
      ]),
    );
  }
  if ('retryOfRequestLogID' in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};
