// Marks this file as a module so its helpers do not leak into other specs.
export {};

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

// The mock-mode flag is read once when the module loads, so each case loads it fresh and
// gets the matching fresh copy of the mocked api client.
async function load(mockMode = false) {
  jest.resetModules();
  if (mockMode) process.env.NEXT_PUBLIC_USE_MOCK_MARKET = 'true';
  else delete process.env.NEXT_PUBLIC_USE_MOCK_MARKET;

  const { marketService } = await import('./market.service');
  const { apiClient } = await import('@/lib/api/client');
  return { marketService, get: apiClient.get as jest.Mock };
}

describe('marketService.getLastRate', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_MARKET;
  });

  it('turns the last SSE frame into a priced market rate', async () => {
    const { marketService, get } = await load();
    get.mockResolvedValue({ data: { latest_rate: JSON.stringify({ bid: 6950, ask: 7000 }) } });

    const rate = await marketService.getLastRate();

    expect(get).toHaveBeenCalledWith('/rates/last-rate');
    expect(rate).toMatchObject({
      mcxBaseRateInr: 7000,
      marginAppliedInr: 100,
      purityLabel: '24K • 99.99%',
    });
    expect(rate?.pricePerGramInr).toBeCloseTo(7313, 4);
    expect(Number.isNaN(Date.parse(rate?.updatedAt ?? ''))).toBe(false);
  });

  it('returns null when the server has no usable rate yet', async () => {
    const { marketService, get } = await load();
    get.mockResolvedValue({ data: { latest_rate: '' } });

    await expect(marketService.getLastRate()).resolves.toBeNull();
  });

  it('lets a request failure reach the caller', async () => {
    const { marketService, get } = await load();
    get.mockRejectedValue({ status: 500, message: 'down' });

    await expect(marketService.getLastRate()).rejects.toMatchObject({ status: 500 });
  });

  it('serves a simulated rate without calling the server in mock mode', async () => {
    const { marketService, get } = await load(true);

    const rate = await marketService.getLastRate();

    expect(get).not.toHaveBeenCalled();
    expect(rate?.pricePerGramInr).toBeGreaterThan(7000);
    expect(rate?.marginAppliedInr).toBe(100);
  });
});
