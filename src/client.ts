// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Orca client.
 *
 * Provides the request pipeline shared by every resource: auth, retries,
 * header/query/body assembly, streaming wiring, and pagination plumbing.
 *
 * `BaseOrca` owns the pipeline; `Orca` is the public entry point that
 * resources mount on. Orca has exactly one auth mode (Bearer), so the
 * credential layer collapses to a single `apiKey` field that may be a
 * string, an async function returning a string, or `null`.
 */

import type { APIPromise } from './core/api-promise';
import { APIPromise as APIPromiseImpl } from './core/api-promise';
import * as Errors from './core/error';
import * as Pagination from './core/pagination';
import { Stream } from './core/streaming';
import type { BodyInit, Fetch, RequestInfo, RequestInit } from './internal/builtin-types';
import { isRunningInBrowser } from './internal/detect-platform';
import { getPlatformHeaders } from './internal/detect-platform';
import { castToError, isAbortError } from './internal/errors';
import {
  buildHeaders,
  type HeadersLike,
  type NullableHeaders,
} from './internal/headers';
import type { APIResponseProps } from './internal/parse';
import { parseResponse } from './internal/parse';
import {
  FallbackEncoder,
  type FinalRequestOptions,
  type RequestOptions,
} from './internal/request-options';
import * as Shims from './internal/shims';
import type {
  FinalizedRequestInit,
  HTTPMethod,
  MergedRequestInit,
  PromiseOrValue,
} from './internal/types';
import { readEnv } from './internal/utils/env';
import {
  formatRequestDetails,
  loggerFor,
  parseLogLevel,
  type LogLevel,
  type Logger,
} from './internal/utils/log';
import { stringifyQuery } from './internal/utils/query';
import { sleep } from './internal/utils/sleep';
import { uuid4 } from './internal/utils/uuid';
import {
  isAbsoluteURL,
  isEmptyObj,
  safeJSON,
  validatePositiveInteger,
} from './internal/utils/values';
import { VERSION } from './version';
import * as AgentsAPI from './resources/agents';
import * as SessionsAPI from './resources/sessions';
import * as EnvironmentsAPI from './resources/environments';
import * as FilesAPI from './resources/files';
import * as SkillsAPI from './resources/skills';
import * as VaultsAPI from './resources/vaults';
import * as MemoryStoresAPI from './resources/memory-stores';
import * as TriggersAPI from './resources/triggers';
import * as GuardrailsAPI from './resources/guardrails';
import * as ModelPricesAPI from './resources/model-prices';
import * as CloudAPI from './resources/cloud';
import * as DiscoveryAPI from './resources/discovery';
import { makeSessionHandle, type SessionHandle } from './lib/session';

export type { Logger, LogLevel } from './internal/utils/log';

/** A function the caller supplies to mint or refresh an Orca API key per request. */
export type ApiKeySetter = () => Promise<string>;

export interface OrcaOptions {
  /**
   * API key used for authentication.
   *
   * - String or async function returning a string.
   * - Defaults to `process.env.ORCA_API_KEY` when unset.
   * - Pass `null` to disable the Bearer header entirely (useful when the
   *   server is behind a separately-authenticated proxy).
   */
  apiKey?: string | ApiKeySetter | null | undefined;

  /**
   * Base URL for the API, e.g. `https://api.orca.example`. Required —
   * defaults to `process.env.ORCA_BASE_URL`. Trailing slashes are
   * stripped.
   */
  baseURL?: string | undefined;

  /**
   * Per-request timeout in milliseconds. Defaults to 10 minutes.
   *
   * @unit milliseconds
   */
  timeout?: number | undefined;

  /**
   * Maximum number of times a transient failure (network error, 408, 409,
   * 429, 5xx) is retried before throwing.
   *
   * @default 2
   */
  maxRetries?: number | undefined;

  /** Default headers attached to every outgoing request. */
  defaultHeaders?: HeadersLike | undefined;

  /** Default query parameters merged into every outgoing URL. */
  defaultQuery?: Record<string, string | undefined> | undefined;

  /** Custom `fetch` implementation. Defaults to the platform-provided global. */
  fetch?: Fetch | undefined;

  /** Additional `RequestInit` options merged into every `fetch` call. */
  fetchOptions?: MergedRequestInit | undefined;

  /**
   * Set to `true` to silence the browser-execution guard. Off by default
   * because the API key would otherwise be exposed to page scripts.
   */
  dangerouslyAllowBrowser?: boolean | undefined;

  /** Logger instance. Defaults to `console`. */
  logger?: Logger | undefined;

  /**
   * Logging verbosity. Defaults to `process.env.ORCA_LOG` or `'warn'`.
   */
  logLevel?: LogLevel | undefined;
}

/**
 * Base class for the Orca client. Owns the entire request pipeline; the
 * concrete {@link Orca} subclass only adds the resource attachments.
 */
export class BaseOrca {
  apiKey: string | ApiKeySetter | null;
  baseURL: string;
  maxRetries: number;
  timeout: number;
  logger: Logger;
  logLevel: LogLevel | undefined;
  fetchOptions: MergedRequestInit | undefined;

  static DEFAULT_TIMEOUT = 600_000; // 10 minutes

  /** The resolved fetch implementation. Exposed so multipart helpers can introspect it. */
  fetch: Fetch;
  protected _options: OrcaOptions;

  /** Successful `GET /apis` results, keyed by effective deployment URL. */
  private extensionGroups = new Map<string, Set<string>>();

  /** In-flight default-control discovery requests, keyed by effective deployment URL. */
  private extensionGroupsPromises = new Map<string, Promise<Set<string>>>();

  /**
   * Constructs a new Orca client.
   *
   * @param {string | ApiKeySetter | null | undefined} [opts.apiKey=process.env['ORCA_API_KEY'] ?? null]
   * @param {string | undefined} [opts.baseURL=process.env['ORCA_BASE_URL']] – Required.
   * @param {number | undefined} [opts.timeout=600000] – Per-request timeout (ms).
   * @param {number | undefined} [opts.maxRetries=2] – Retry cap for transient failures.
   * @param {HeadersLike | undefined} [opts.defaultHeaders] – Headers merged into every request.
   * @param {Record<string, string | undefined> | undefined} [opts.defaultQuery] – Query merged into every URL.
   * @param {Fetch | undefined} [opts.fetch=globalThis.fetch] – Custom fetch implementation.
   * @param {MergedRequestInit | undefined} [opts.fetchOptions] – `RequestInit` merged into every `fetch`.
   * @param {boolean | undefined} [opts.dangerouslyAllowBrowser=false] – Bypass the browser guard.
   * @param {Logger | undefined} [opts.logger=console] – Logger instance.
   * @param {LogLevel | undefined} [opts.logLevel=process.env['ORCA_LOG'] ?? 'warn'] – Log verbosity.
   */
  constructor({ baseURL = readEnv('ORCA_BASE_URL'), apiKey, ...opts }: OrcaOptions = {}) {
    // Resolve apiKey: undefined falls back to env, an explicit null disables auth.
    if (apiKey === undefined) {
      apiKey = readEnv('ORCA_API_KEY') ?? null;
    }

    if (!baseURL) {
      throw new Errors.OrcaError(
        'baseURL is required: pass `baseURL` to the Orca constructor or set ORCA_BASE_URL',
      );
    }

    if (!opts.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new Errors.OrcaError(
        "It looks like you're running in a browser-like environment.\n\n" +
          'This is disabled by default, as it risks exposing your secret API credentials to attackers. ' +
          'If you understand the risks and have appropriate mitigations in place, ' +
          'you can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\n' +
          'new Orca({ apiKey, baseURL, dangerouslyAllowBrowser: true });\n',
      );
    }

    // `baseURL` is the host root — every path appends the full route,
    // including its own `/v1` or `/apis/...` prefix. Older callers (and
    // the hosted distribution's pre-core-paths docs) pass what used to be
    // required: a `/v1/registry`, `/v1`, or `/api/v1` suffix. Strip it so
    // they keep working, and warn so they notice and update it.
    //
    // `/api/v1` gets the same treatment as the other two, not a special
    // "leave it alone" case: stripping only `/v1` from `.../api/v1` would
    // leave `.../api`, where core paths still resolve (via the `/api/v1/*`
    // alias) but `/apis/...` extension paths don't — silently broken for
    // half the SDK's surface. Stripping the whole `/api/v1` suffix leaves
    // the actual host root, where both resolve correctly.
    const trimmedBaseURL = baseURL.replace(/\/+$/, '');
    const parsedBaseURL = new URL(trimmedBaseURL);
    const trimmedBasePathname = parsedBaseURL.pathname.replace(/\/+$/, '');
    const legacyBaseURLSuffix = /\/api\/v1$|\/v1\/registry$|\/v1$/.exec(
      trimmedBasePathname,
    )?.[0];
    if (legacyBaseURLSuffix) {
      parsedBaseURL.pathname = trimmedBasePathname.slice(
        0,
        trimmedBasePathname.length - legacyBaseURLSuffix.length,
      );
      this.baseURL = parsedBaseURL.toString().replace(/\/+$/, '');
    } else {
      this.baseURL = trimmedBaseURL;
    }
    this.timeout = opts.timeout ?? BaseOrca.DEFAULT_TIMEOUT;
    this.maxRetries = opts.maxRetries ?? 2;

    this.logger = opts.logger ?? console;
    const defaultLogLevel: LogLevel = 'warn';
    // Seed logLevel before parseLogLevel so the warning path inside it can find a logger.
    this.logLevel = defaultLogLevel;
    this.logLevel =
      parseLogLevel(opts.logLevel, 'OrcaOptions.logLevel', this) ??
      parseLogLevel(readEnv('ORCA_LOG'), "process.env['ORCA_LOG']", this) ??
      defaultLogLevel;

    if (legacyBaseURLSuffix) {
      loggerFor(this).warn(
        `baseURL ${JSON.stringify(baseURL)} ends with "${legacyBaseURLSuffix}", which is no ` +
          `longer part of the base URL — every deployment now serves core at the host root ` +
          `(e.g. \`GET {base}/v1/agents\`). Using ${JSON.stringify(this.baseURL)} instead. ` +
          'Update ORCA_BASE_URL / the `baseURL` option to the host root; this compatibility ' +
          'shim may be removed in a future major version.',
      );
    }

    this.fetchOptions = opts.fetchOptions;
    this.fetch = opts.fetch ?? Shims.getDefaultFetch();
    this.apiKey = apiKey;

    this._options = { ...opts, baseURL, apiKey };
  }

  // ---- Extension hooks --------------------------------------------------

  protected defaultQuery(): Record<string, string | undefined> | undefined {
    return this._options.defaultQuery;
  }

  protected validateHeaders(_headers: NullableHeaders): void {
    // No-op by default. Subclasses can enforce that auth headers exist.
  }

  /** Mutate the resolved request options before headers/URL are built. */
  protected async prepareOptions(_options: FinalRequestOptions): Promise<void> {}

  /** Mutate the final `RequestInit` before it hits `fetch`. */
  protected async prepareRequest(
    _request: RequestInit,
    _ctx: { url: string; options: FinalRequestOptions },
  ): Promise<void> {}

  protected getUserAgent(): string {
    return `${this.constructor.name}/JS ${VERSION}`;
  }

  protected defaultIdempotencyKey(): string {
    return `orca-node-retry-${uuid4()}`;
  }

  protected makeStatusError(
    status: number,
    error: Object,
    message: string | undefined,
    headers: Headers,
  ): Errors.APIError {
    return Errors.APIError.generate(status, error, message, headers);
  }

  /**
   * Resolves the API key and returns the `Authorization` header — or
   * `undefined` if auth is disabled. Async to support rotation callbacks.
   */
  protected async bearerAuth(_opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    if (this.apiKey == null) return undefined;
    let token: string;
    if (typeof this.apiKey === 'function') {
      try {
        token = await this.apiKey();
      } catch (err) {
        throw new Errors.OrcaError(
          `apiKey function threw while resolving credentials: ${(err as Error).message}`,
          // @ts-ignore - cause is supported at runtime on modern engines
          { cause: err },
        );
      }
      if (typeof token !== 'string' || token.length === 0) {
        throw new Errors.OrcaError(
          'apiKey function must return a non-empty string',
        );
      }
    } else {
      token = this.apiKey;
      if (token.length === 0) {
        throw new Errors.OrcaError(
          'apiKey must not be empty: pass a non-empty string, an async function, or null to disable auth',
        );
      }
    }
    return buildHeaders([{ Authorization: `Bearer ${token}` }]);
  }

  // ---- URL / Header / Body builders ------------------------------------

  buildURL(
    path: string,
    query: Record<string, unknown> | null | undefined,
    defaultBaseURL?: string | undefined,
  ): string {
    const baseURL = defaultBaseURL ?? this.baseURL;
    const url =
      isAbsoluteURL(path) ?
        new URL(path)
      : new URL(baseURL + (baseURL.endsWith('/') && path.startsWith('/') ? path.slice(1) : path));

    const defaultQuery = this.defaultQuery();
    const pathQuery = Object.fromEntries(url.searchParams);
    if (!isEmptyObj(defaultQuery) || !isEmptyObj(pathQuery)) {
      query = { ...pathQuery, ...defaultQuery, ...query };
    }

    if (typeof query === 'object' && query && !Array.isArray(query)) {
      url.search = stringifyQuery(query as Record<string, unknown>);
    }

    return url.toString();
  }

  private async buildHeaders({
    options,
    method,
    bodyHeaders,
    retryCount,
  }: {
    options: FinalRequestOptions;
    method: HTTPMethod;
    bodyHeaders: HeadersLike;
    retryCount: number;
  }): Promise<Headers> {
    const idempotencyHeaders: Record<string, string> = {};
    if (method !== 'get' && options.idempotencyKey) {
      idempotencyHeaders['Idempotency-Key'] = options.idempotencyKey;
    }

    const headers = buildHeaders([
      idempotencyHeaders,
      {
        // SSE endpoints (stream: true) content-negotiate strictly and 406 on
        // `application/json`; ask for the event-stream media type instead.
        Accept: options.stream ? 'text/event-stream' : 'application/json',
        'User-Agent': this.getUserAgent(),
        'X-Orca-Retry-Count': String(retryCount),
        ...(options.timeout ? { 'X-Orca-Timeout': String(Math.trunc(options.timeout / 1000)) } : {}),
        ...getPlatformHeaders(),
      },
      await this.bearerAuth(options),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers,
    ]);

    this.validateHeaders(headers);

    return headers.values;
  }

  private buildBody({
    options: { body, headers: rawHeaders },
  }: {
    options: FinalRequestOptions;
  }): { bodyHeaders: HeadersLike; body: BodyInit | undefined } {
    if (body == null) {
      return { bodyHeaders: undefined, body: undefined };
    }
    const headers = buildHeaders([rawHeaders]);
    if (
      ArrayBuffer.isView(body) ||
      body instanceof ArrayBuffer ||
      body instanceof DataView ||
      (typeof body === 'string' && headers.values.has('content-type')) ||
      ((globalThis as { Blob?: typeof Blob }).Blob && body instanceof (globalThis as { Blob?: typeof Blob }).Blob!) ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      ((globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream &&
        body instanceof (globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream!)
    ) {
      return { bodyHeaders: undefined, body: body as BodyInit };
    } else if (
      typeof body === 'object' &&
      (Symbol.asyncIterator in (body as object) ||
        (Symbol.iterator in (body as object) &&
          'next' in (body as object) &&
          typeof (body as { next?: unknown }).next === 'function'))
    ) {
      return {
        bodyHeaders: undefined,
        body: Shims.ReadableStreamFrom(body as AsyncIterable<Uint8Array>),
      };
    } else {
      return FallbackEncoder({ body, headers });
    }
  }

  // ---- Request building -------------------------------------------------

  async buildRequest(
    inputOptions: FinalRequestOptions,
    { retryCount = 0 }: { retryCount?: number } = {},
  ): Promise<{ req: FinalizedRequestInit; url: string; timeout: number }> {
    const options = { ...inputOptions };
    const { method, path, query, defaultBaseURL } = options;

    const url = this.buildURL(path, (query ?? undefined) as Record<string, unknown> | undefined, defaultBaseURL);

    if ('timeout' in options && options.timeout !== undefined) {
      validatePositiveInteger('timeout', options.timeout);
    }
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body } = this.buildBody({ options });
    const reqHeaders = await this.buildHeaders({
      options: inputOptions,
      method,
      bodyHeaders,
      retryCount,
    });

    const isReadableBody =
      ((globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream &&
        body instanceof (globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream!) ||
      (typeof body === 'object' && body !== null && Symbol.asyncIterator in (body as object));

    const req: FinalizedRequestInit = {
      method,
      ...((this.fetchOptions as any) ?? {}),
      ...((options.fetchOptions as any) ?? {}),
      ...(isReadableBody && { duplex: 'half' as const }),
      ...(options.signal != null && { signal: options.signal }),
      ...(body != null && { body: body as BodyInit }),
      // Set headers last so caller-supplied fetchOptions can't smuggle in
      // an unsigned `Authorization` value past the auth pipeline.
      headers: reqHeaders,
    };

    return { req, url, timeout: options.timeout };
  }

  // ---- Method wrappers -------------------------------------------------

  get<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('get', path, opts);
  }

  post<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('post', path, opts);
  }

  patch<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('patch', path, opts);
  }

  put<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('put', path, opts);
  }

  delete<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('delete', path, opts);
  }

  private methodRequest<Rsp>(
    method: HTTPMethod,
    path: string,
    opts?: PromiseOrValue<RequestOptions>,
  ): APIPromise<Rsp> {
    return this.request(
      Promise.resolve(opts).then((resolved) => ({ method, path, ...(resolved ?? {}) })),
    );
  }

  request<Rsp>(
    options: PromiseOrValue<FinalRequestOptions>,
    remainingRetries: number | null = null,
  ): APIPromise<Rsp> {
    const responsePromise = this.makeRequest(options, remainingRetries, undefined);
    return new APIPromiseImpl<Rsp>(responsePromise, async (props) => {
      return (await parseResponse(this, props)) as Rsp;
    });
  }

  // ---- Pagination helpers ----------------------------------------------

  getAPIList<Item, PageClass extends Pagination.PageCursor<Item> = Pagination.PageCursor<Item>>(
    path: string,
    Page: new (
      client: Pagination.PageClient,
      response: Pagination.PageCursorResponse<Item>,
      options: FinalRequestOptions,
    ) => PageClass,
    opts?: PromiseOrValue<RequestOptions>,
  ): Pagination.PagePromise<PageClass, Item> {
    return this.requestAPIList<Item, PageClass>(
      Page,
      opts && typeof opts === 'object' && 'then' in opts ?
        (opts as Promise<RequestOptions>).then((resolved) => ({ method: 'get' as const, path, ...resolved }))
      : ({ method: 'get' as const, path, ...((opts as RequestOptions) ?? {}) } as FinalRequestOptions),
    );
  }

  requestAPIList<
    Item = unknown,
    PageClass extends Pagination.PageCursor<Item> = Pagination.PageCursor<Item>,
  >(
    Page: new (
      client: Pagination.PageClient,
      response: Pagination.PageCursorResponse<Item>,
      options: FinalRequestOptions,
    ) => PageClass,
    options: PromiseOrValue<FinalRequestOptions>,
  ): Pagination.PagePromise<PageClass, Item> {
    const request = this.makeRequest(options, null, undefined);
    return new Pagination.PagePromise<PageClass, Item>(this, request, Page);
  }

  // ---- Core request loop -----------------------------------------------

  private async makeRequest(
    optionsInput: PromiseOrValue<FinalRequestOptions>,
    retriesRemaining: number | null,
    retryOfRequestLogID: string | undefined,
  ): Promise<APIResponseProps> {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) retriesRemaining = maxRetries;

    await this.prepareOptions(options);

    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining,
    });

    await this.prepareRequest(req, { url, options });

    const requestLogID =
      'log_' + ((Math.random() * (1 << 24)) | 0).toString(16).padStart(6, '0');
    const retryLogStr = retryOfRequestLogID === undefined ? '' : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();

    loggerFor(this).debug(
      `[${requestLogID}] sending request`,
      formatRequestDetails({
        retryOfRequestLogID,
        method: options.method,
        url,
        options,
        headers: req.headers,
      }),
    );

    if (options.signal?.aborted) {
      throw new Errors.APIUserAbortError();
    }

    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
    const headersTime = Date.now();

    if (response instanceof globalThis.Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if (options.signal?.aborted) {
        throw new Errors.APIUserAbortError();
      }
      const isTimeout =
        isAbortError(response) ||
        /timed? ?out/i.test(
          String(response) +
            ('cause' in response ? String((response as { cause?: unknown }).cause) : ''),
        );
      if (retriesRemaining) {
        loggerFor(this).info(
          `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} - ${retryMessage}`,
        );
        loggerFor(this).debug(
          `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} (${retryMessage})`,
          formatRequestDetails({
            retryOfRequestLogID,
            url,
            durationMs: headersTime - startTime,
            message: response.message,
          }),
        );
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      loggerFor(this).info(
        `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} - error; no more retries left`,
      );
      loggerFor(this).debug(
        `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} (error; no more retries left)`,
        formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message,
        }),
      );
      if (isTimeout) {
        throw new Errors.APIConnectionTimeoutError();
      }
      throw new Errors.APIConnectionError({ cause: response });
    }

    const specialHeaders = [...response.headers.entries()]
      .filter(([name]) => name === 'request-id')
      .map(([name, value]) => ', ' + name + ': ' + JSON.stringify(value))
      .join('');
    const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${
      response.ok ? 'succeeded' : 'failed'
    } with status ${response.status} in ${headersTime - startTime}ms`;

    if (!response.ok) {
      const shouldRetry = await this.shouldRetry(response, options);
      if (retriesRemaining && shouldRetry) {
        const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
        await cancelResponseBody(response);
        loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
        loggerFor(this).debug(
          `[${requestLogID}] response error (${retryMessage})`,
          formatRequestDetails({
            retryOfRequestLogID,
            url: response.url,
            status: response.status,
            headers: response.headers,
            durationMs: headersTime - startTime,
          }),
        );
        return this.retryRequest(
          options,
          retriesRemaining,
          retryOfRequestLogID ?? requestLogID,
          response.headers,
        );
      }

      const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);

      const errText = await response.text().catch((err: unknown) => castToError(err).message);
      const errJSON = safeJSON(errText) as Record<string, unknown> | undefined;
      const errMessage = errJSON ? undefined : errText;

      loggerFor(this).debug(
        `[${requestLogID}] response error (${retryMessage})`,
        formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          message: errMessage,
          durationMs: Date.now() - startTime,
        }),
      );

      throw this.makeStatusError(response.status, errJSON as Object, errMessage, response.headers);
    }

    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(
      `[${requestLogID}] response start`,
      formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        durationMs: headersTime - startTime,
      }),
    );

    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }

  async fetchWithTimeout(
    url: RequestInfo,
    init: RequestInit | undefined,
    ms: number,
    controller: AbortController,
  ): Promise<Response> {
    const { signal, method, ...options } = init || {};
    const abort = this._makeAbort(controller);
    if (signal) signal.addEventListener('abort', abort, { once: true });

    const timeout = setTimeout(abort, ms);

    const isReadableBody =
      ((globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream &&
        options.body instanceof (globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream!) ||
      (typeof options.body === 'object' &&
        options.body !== null &&
        Symbol.asyncIterator in (options.body as object));

    const fetchOptions: RequestInit = {
      signal: controller.signal as AbortSignal,
      ...(isReadableBody ? { duplex: 'half' as const } : {}),
      method: 'GET',
      ...options,
    };
    if (method) {
      fetchOptions.method = method.toUpperCase();
    }

    try {
      return await this.fetch.call(undefined, url, fetchOptions);
    } finally {
      clearTimeout(timeout);
    }
  }

  private _makeAbort(controller: AbortController): () => void {
    // Stand-alone factory keeps the abort listener from closing over the
    // request body / options object, which would prevent GC until the
    // caller's signal fires.
    return () => controller.abort();
  }

  private async shouldRetry(response: Response, _options: FinalRequestOptions): Promise<boolean> {
    // Honor an explicit server hint when present.
    const shouldRetryHeader = response.headers.get('x-should-retry');
    if (shouldRetryHeader === 'true') return true;
    if (shouldRetryHeader === 'false') return false;

    if (response.status === 408) return true; // Request Timeout
    if (response.status === 409) return true; // Conflict (lock contention)
    if (response.status === 429) return true; // Too Many Requests
    if (response.status >= 500) return true;
    return false;
  }

  private async retryRequest(
    options: FinalRequestOptions,
    retriesRemaining: number,
    requestLogID: string,
    responseHeaders?: Headers | undefined,
  ): Promise<APIResponseProps> {
    let timeoutMillis: number | undefined;

    // `retry-after-ms` is non-standard but useful when present.
    const retryAfterMillisHeader = responseHeaders?.get('retry-after-ms');
    if (retryAfterMillisHeader) {
      const ms = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(ms)) timeoutMillis = ms;
    }

    const retryAfterHeader = responseHeaders?.get('retry-after');
    if (retryAfterHeader && timeoutMillis === undefined) {
      const seconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(seconds)) {
        timeoutMillis = seconds * 1000;
      } else {
        const parsed = Date.parse(retryAfterHeader);
        if (Number.isFinite(parsed)) {
          timeoutMillis = Math.max(0, parsed - Date.now());
        }
      }
    }

    if (timeoutMillis === undefined) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);

    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }

  private calculateDefaultRetryTimeoutMillis(retriesRemaining: number, maxRetries: number): number {
    const initialRetryDelay = 0.5; // seconds
    const maxRetryDelay = 8.0; // seconds
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter * 1000;
  }

  // ---- Extension discovery / gating -------------------------------------

  /**
   * Ensures the connected deployment advertises `group` before a gated call
   * proceeds. Extension resources and extension-owned fields on core requests
   * use this shared capability check.
   *
   * Caching strategy: successful `GET /apis` results are cached per effective
   * deployment URL. Concurrent initial calls share an in-flight request only
   * when neither supplies per-call request controls; controlled calls probe
   * independently so one caller's authentication, timeout, or abort signal
   * cannot affect another caller. A failed discovery attempt is not cached.
   *
   * Throws {@link Errors.ExtensionNotAvailableError} when `group` isn't
   * advertised. An empty (or non-matching) `groups` list is treated as a
   * normal, ungated deployment — not an error condition in itself. A 404
   * from `/apis` itself (a deployment that predates the discovery
   * endpoint) is folded into the same "unavailable" outcome but also logs
   * a version warning, since that's a stronger signal of an outdated
   * deployment than an empty list is.
   */
  async ensureExtensionAvailable(group: string, options?: RequestOptions): Promise<void> {
    const deploymentURL = options?.defaultBaseURL ?? this.baseURL;
    let groups = this.extensionGroups.get(deploymentURL);
    if (!groups) {
      const hasRequestControls =
        options?.headers !== undefined ||
        options?.maxRetries !== undefined ||
        options?.timeout !== undefined ||
        options?.fetchOptions !== undefined ||
        options?.signal !== undefined;

      if (hasRequestControls) {
        groups = await this.fetchExtensionGroups(options);
      } else {
        let groupsPromise = this.extensionGroupsPromises.get(deploymentURL);
        if (!groupsPromise) {
          groupsPromise = this.fetchExtensionGroups(options).finally(() => {
            this.extensionGroupsPromises.delete(deploymentURL);
          });
          this.extensionGroupsPromises.set(deploymentURL, groupsPromise);
        }
        groups = await groupsPromise;
      }
      this.extensionGroups.set(deploymentURL, groups);
    }

    if (!groups.has(group)) {
      throw new Errors.ExtensionNotAvailableError(
        group,
        `This deployment does not advertise the "${group}" extension group (GET /apis ` +
          `groups: [${[...groups].join(', ')}]). This request requires a deployment that ` +
          'serves the extension group.',
      );
    }
  }

  private async fetchExtensionGroups(options?: RequestOptions): Promise<Set<string>> {
    let groupList: DiscoveryAPI.APIGroupList;
    try {
      groupList = await this.get<DiscoveryAPI.APIGroupList>('/apis', {
        ...(options?.defaultBaseURL !== undefined && { defaultBaseURL: options.defaultBaseURL }),
        ...(options?.headers !== undefined && { headers: options.headers }),
        ...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries }),
        ...(options?.timeout !== undefined && { timeout: options.timeout }),
        ...(options?.fetchOptions !== undefined && { fetchOptions: options.fetchOptions }),
        ...(options?.signal !== undefined && { signal: options.signal }),
      });
    } catch (err) {
      if (err instanceof Errors.NotFoundError) {
        // Pre-discovery deployment: `/apis` itself 404s. Different from a
        // 200 with an empty `groups` array, which just means "no
        // extensions installed" on a deployment that supports discovery.
        loggerFor(this).warn(
          'GET /apis returned 404 — this deployment predates extension discovery and cannot ' +
            'serve any gated extension methods (e.g. `orca.cloud.*`). Confirm the server ' +
            'version if this is unexpected.',
        );
        return new Set();
      }
      throw err;
    }
    return new Set(groupList.groups.map((g) => g.name));
  }

  // Static re-exports, so error classes and `Stream` are reachable from the client class (`Orca.APIError`).
  static OrcaError = Errors.OrcaError;
  static ExtensionNotAvailableError = Errors.ExtensionNotAvailableError;
  static APIError = Errors.APIError;
  static APIConnectionError = Errors.APIConnectionError;
  static APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
  static APIUserAbortError = Errors.APIUserAbortError;
  static NotFoundError = Errors.NotFoundError;
  static ConflictError = Errors.ConflictError;
  static RateLimitError = Errors.RateLimitError;
  static BadRequestError = Errors.BadRequestError;
  static AuthenticationError = Errors.AuthenticationError;
  static InternalServerError = Errors.InternalServerError;
  static PermissionDeniedError = Errors.PermissionDeniedError;
  static UnprocessableEntityError = Errors.UnprocessableEntityError;

  static Stream = Stream;
}

/**
 * Cancels a response body we have decided not to consume so the underlying
 * connection can be returned to the pool.
 */
async function cancelResponseBody(response: Response): Promise<void> {
  const body = response.body;
  if (body == null) return;
  try {
    const reader = body.getReader();
    const cancelPromise = reader.cancel();
    reader.releaseLock();
    await cancelPromise;
  } catch {
    // best-effort
  }
}

/**
 * Public Orca client.
 */
export class Orca extends BaseOrca {
  /** Agent registry resource — create, list, retrieve, update, and archive agents. */
  agents: AgentsAPI.Agents = new AgentsAPI.Agents(this);

  /** Sessions resource — create, list, retrieve, update, delete, and archive sessions. */
  sessions: SessionsAPI.Sessions = new SessionsAPI.Sessions(this);

  /** Environments resource — create, list, retrieve, update, delete, and archive environments. */
  environments: EnvironmentsAPI.Environments = new EnvironmentsAPI.Environments(this);

  /** Files resource — upload, list, retrieve, and delete files. */
  files: FilesAPI.Files = new FilesAPI.Files(this);

  /** Skills resource — create (multipart), list, retrieve, delete, and manage versions. */
  skills: SkillsAPI.Skills = new SkillsAPI.Skills(this);

  /** Vaults resource — create, retrieve, update, list, delete, archive, and manage credentials. */
  vaults: VaultsAPI.Vaults = new VaultsAPI.Vaults(this);

  /** Memory stores resource — create, retrieve, update, list, delete, archive, plus memories and versions. */
  memoryStores: MemoryStoresAPI.MemoryStores = new MemoryStoresAPI.MemoryStores(this);

  /** Triggers resource — create, list, retrieve, update, delete, pause, and unpause triggers. */
  triggers: TriggersAPI.Triggers = new TriggersAPI.Triggers(this);

  /** Guardrails policy extension — author, inspect, archive, and delete guardrails. */
  guardrails: GuardrailsAPI.Guardrails = new GuardrailsAPI.Guardrails(this);

  /** Pricing extension — inspect effective model prices used for cost accounting. */
  modelPrices: ModelPricesAPI.ModelPrices = new ModelPricesAPI.ModelPrices(this);

  /**
   * Hosted extensions — providers, functions, connections, packages, catalogs,
   * and connectors in the hosted extension group, served under `/apis/cloud.sn.io/v1/*`. Methods here throw
   * {@link Errors.ExtensionNotAvailableError} against a deployment that
   * doesn't advertise `cloud.sn.io` (e.g. the open-source engine).
   */
  cloud: CloudAPI.Cloud = new CloudAPI.Cloud(this);

  /** Extension API group discovery — `GET /apis`. */
  discovery: DiscoveryAPI.Discovery = new DiscoveryAPI.Discovery(this);

  /**
   * Returns an ergonomic handle for a specific session, pre-filling the
   * sessionId for all sub-resource calls.
   *
   * @example
   * ```ts
   * const handle = orca.session('session_id');
   * await handle.events.send({
   *   events: [{ type: 'user.message', content: [{ type: 'text', text: 'Hello' }] }],
   * });
   * for await (const event of await handle.events.stream()) { ... }
   * ```
   */
  session(sessionId: string): SessionHandle {
    return makeSessionHandle(this, sessionId);
  }
}
