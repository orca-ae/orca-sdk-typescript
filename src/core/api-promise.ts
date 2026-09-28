// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { APIResponseProps } from '../internal/parse';
import type { PromiseOrValue } from '../internal/types';

/**
 * A subclass of `Promise` providing additional helper methods
 * for interacting with the SDK.
 */
export class APIPromise<T> extends Promise<T> {
  private parsedPromise: Promise<T> | undefined;

  constructor(
    private responsePromise: Promise<APIResponseProps>,
    private parseResponse: (props: APIResponseProps) => PromiseOrValue<T>,
  ) {
    super((resolve) => {
      // no-op: .then / .catch / .finally are overridden to drive parsing
      resolve(null as any);
    });
  }

  /**
   * Gets the raw `Response` instance instead of parsing the response data.
   *
   * If you want to parse the response body and also get the `Response`
   * instance, use {@link withResponse()}.
   */
  asResponse(): Promise<Response> {
    return this.responsePromise.then((p) => p.response);
  }

  /**
   * Gets both the parsed response data and the raw `Response` instance.
   *
   * If you only need the raw `Response`, use {@link asResponse()}.
   */
  async withResponse(): Promise<{ data: T; response: Response }> {
    const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
    return { data, response };
  }

  private parse(): Promise<T> {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then(
        (props) => this.parseResponse(props) as Promise<T>,
      );
    }
    return this.parsedPromise;
  }

  override then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.parse().then(onfulfilled, onrejected);
  }

  override catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.parse().catch(onrejected);
  }

  override finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this.parse().finally(onfinally);
  }
}

// Re-exported for the request pipeline.
export type { APIResponseProps };
