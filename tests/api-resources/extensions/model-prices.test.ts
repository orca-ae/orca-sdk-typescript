// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Orca } from '../../../src/client';
import { ExtensionNotAvailableError } from '../../../src/core/error';
import { PageCursor } from '../../../src/core/pagination';
import { PRICING_EXTENSION_GROUP } from '../../../src/internal/constants';
import type { ModelPrice } from '../../../src/resources/model-prices';
import { jsonResponse, makeExtensionClient, makeUnavailableExtensionClient } from './helpers';

const MODEL_PRICE: ModelPrice = {
  type: 'model_price',
  provider: 'provider-a',
  model_id: 'model-alpha',
  input_per_million_tokens: 3,
  output_per_million_tokens: 15,
  cache_read_per_million_tokens: 0.3,
  cache_write_per_million_tokens: 3.75,
};

function responseForModelPriceRequest(url: string): Response {
  return new URL(url).pathname.endsWith('/modelprices')
    ? jsonResponse({ data: [MODEL_PRICE], next_page: null })
    : jsonResponse(MODEL_PRICE);
}

async function makeClient() {
  return makeExtensionClient(PRICING_EXTENSION_GROUP, responseForModelPriceRequest);
}

describe('Model prices extension', () => {
  it('lists effective prices with page-token pagination', async () => {
    const { orca, calls } = await makeClient();
    const page = await orca.modelPrices.list({ limit: 10, page: 'next' });

    expect(page).toBeInstanceOf(PageCursor);
    expect(page.data).toEqual([MODEL_PRICE]);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/apis/pricing.runorca.ai/v1/modelprices');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('page')).toBe('next');
  });

  it('retrieves a provider-qualified model price and URL-encodes the model ID', async () => {
    const { orca, calls } = await makeClient();
    const result = await orca.modelPrices.retrieve('model/alpha', { provider: 'provider-a' });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/apis/pricing.runorca.ai/v1/modelprices/model%2Falpha');
    expect(url.searchParams.get('provider')).toBe('provider-a');
    expect(result).toEqual(MODEL_PRICE);
  });

  const callsWithOptions: Array<[string, (orca: Orca) => PromiseLike<unknown>]> = [
    ['list', (orca) => orca.modelPrices.list({}, { headers: { 'X-Test': 'list' } })],
    [
      'retrieve',
      (orca) => orca.modelPrices.retrieve('model-alpha', {}, { headers: { 'X-Test': 'retrieve' } }),
    ],
  ];

  test.each(callsWithOptions)('%s passes RequestOptions through', async (name, invoke) => {
    const { orca, calls } = await makeClient();
    await invoke(orca);
    expect((calls[0]!.init?.headers as Headers).get('X-Test')).toBe(name);
  });

  test.each(callsWithOptions)(
    '%s fails before the business request when pricing is unavailable',
    async (_name, invoke) => {
      const { orca, calls } = makeUnavailableExtensionClient();
      await expect(invoke(orca)).rejects.toBeInstanceOf(ExtensionNotAvailableError);
      expect(calls.map((call) => call.url)).toEqual(['https://api.example.test/apis']);
    },
  );
});
