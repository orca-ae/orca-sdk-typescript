// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { APIResponseProps } from '../internal/parse';
import type { FinalRequestOptions } from '../internal/request-options';
import { APIPromise } from './api-promise';

/**
 * Minimal client surface PageCursor needs. We deliberately don't import
 * the concrete `Orca` type so this module stays cheap and doesn't pull in
 * the request pipeline for code that only walks pages it already has.
 */
export interface PageClient {
  requestAPIList<Item, P extends PageCursor<Item> = PageCursor<Item>>(
    Page: new (client: PageClient, response: PageCursorResponse<Item>, options: FinalRequestOptions) => P,
    options: FinalRequestOptions,
  ): PagePromise<P, Item>;
}

export type PageCursorParams = {
  limit?: number;
  page?: string;
};

export interface PageCursorResponse<T> {
  data: T[];
  /** Present on ID-cursor endpoints such as files. */
  has_more?: boolean;
  first_id?: string | null;
  last_id?: string | null;
  /** Present on opaque page-token endpoints. */
  next_page?: string | null;
  prev_page?: string | null;
}

/**
 * Paginated response wrapper. Implements async iteration so callers can
 * `for await (const item of orca.agents.list()) { ... }` without manually
 * walking pages.
 */
export class PageCursor<T> implements AsyncIterable<T> {
  data: T[];
  has_more?: boolean;
  first_id?: string | null;
  last_id?: string | null;
  next_page?: string | null;
  prev_page?: string | null;
  protected options: FinalRequestOptions;
  protected client: PageClient;

  constructor(client: PageClient, response: PageCursorResponse<T>, options: FinalRequestOptions) {
    this.client = client;
    this.options = options;
    this.data = response.data;
    if (response.has_more !== undefined) this.has_more = response.has_more;
    if (response.first_id !== undefined) this.first_id = response.first_id;
    if (response.last_id !== undefined) this.last_id = response.last_id;
    if (response.next_page !== undefined) this.next_page = response.next_page;
    if (response.prev_page !== undefined) this.prev_page = response.prev_page;
  }

  hasNextPage(): boolean {
    if (this.next_page) return true;
    const query = this.options.query as Record<string, unknown> | null | undefined;
    const isBeforeCursorPage = query?.['before_id'] !== undefined;
    return this.has_more === true && !!(isBeforeCursorPage ? this.first_id : this.last_id);
  }

  getPaginatedItems(): T[] {
    return this.data;
  }

  /** Fetch the next page, throwing if none available. */
  async getNextPage(): Promise<PageCursor<T>> {
    if (!this.hasNextPage()) {
      throw new Error('No more pages to fetch');
    }
    const query: Record<string, unknown> = { ...(this.options.query ?? {}) };
    if (this.next_page) {
      query['page'] = this.next_page;
    } else if (query['before_id'] !== undefined && this.first_id) {
      delete query['after_id'];
      query['before_id'] = this.first_id;
    } else if (this.last_id) {
      delete query['before_id'];
      query['after_id'] = this.last_id;
    }
    const nextOptions: FinalRequestOptions = {
      ...this.options,
      query,
    };
    return this.client.requestAPIList<T, PageCursor<T>>(
      PageCursor as new (
        client: PageClient,
        response: PageCursorResponse<T>,
        options: FinalRequestOptions,
      ) => PageCursor<T>,
      nextOptions,
    );
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let page: PageCursor<T> = this;
    while (true) {
      for (const item of page.data) yield item;
      if (!page.hasNextPage()) return;
      page = await page.getNextPage();
    }
  }
}

/**
 * APIPromise-like wrapper that returns a `PageCursor<T>` on resolution AND
 * supports async iteration directly:
 *   for await (const item of orca.agents.list()) { ... }
 *   const page = await orca.agents.list();
 */
export class PagePromise<P extends PageCursor<T>, T> extends APIPromise<P> implements AsyncIterable<T> {
  constructor(
    client: PageClient,
    request: Promise<APIResponseProps>,
    PageClass: new (client: PageClient, response: PageCursorResponse<T>, options: FinalRequestOptions) => P,
  ) {
    super(request, async (props) => {
      const body = (await props.response.json()) as PageCursorResponse<T>;
      return new PageClass(client, body, props.options);
    });
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    const page = await this;
    yield* page;
  }
}
