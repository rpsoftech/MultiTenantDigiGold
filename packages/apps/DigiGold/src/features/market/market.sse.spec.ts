import type { LiveRateListener } from './market.sse';

class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
}

// The stream is a module-level singleton, so each test starts from a fresh copy.
async function load(options: { mockMode?: boolean; baseUrl?: string | null } = {}) {
  const { mockMode = false, baseUrl = 'http://api.test/api/v1' } = options;
  jest.resetModules();
  if (mockMode) process.env.NEXT_PUBLIC_USE_MOCK_MARKET = 'true';
  else delete process.env.NEXT_PUBLIC_USE_MOCK_MARKET;
  if (baseUrl === null) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = baseUrl;

  return import('./market.sse');
}

function makeListener(): jest.Mocked<LiveRateListener> {
  return { onTick: jest.fn(), onStatusChange: jest.fn() };
}

describe('subscribeToLiveRate', () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  let now = 1_000_000;

  beforeEach(() => {
    FakeEventSource.instances = [];
    Object.defineProperty(window, 'EventSource', {
      writable: true,
      configurable: true,
      value: FakeEventSource,
    });
    Object.defineProperty(globalThis, 'EventSource', {
      writable: true,
      configurable: true,
      value: FakeEventSource,
    });
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_USE_MOCK_MARKET;
    if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase;
  });

  it('opens one stream at the rates endpoint and reports connecting', async () => {
    const { subscribeToLiveRate } = await load({ baseUrl: 'http://api.test/api/v1///' });
    const listener = makeListener();

    subscribeToLiveRate(listener);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('http://api.test/api/v1/rates/stream');
    expect(listener.onStatusChange).toHaveBeenLastCalledWith('connecting');
  });

  it('shares a single connection between subscribers', async () => {
    const { subscribeToLiveRate } = await load();

    subscribeToLiveRate(makeListener());
    subscribeToLiveRate(makeListener());

    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('reports an error and opens nothing when no API origin is configured', async () => {
    const { subscribeToLiveRate } = await load({ baseUrl: null });
    const listener = makeListener();

    subscribeToLiveRate(listener);

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(listener.onStatusChange).toHaveBeenLastCalledWith('error');
  });

  it('tells every subscriber when the stream opens', async () => {
    const { subscribeToLiveRate } = await load();
    const first = makeListener();
    const second = makeListener();
    subscribeToLiveRate(first);
    subscribeToLiveRate(second);

    FakeEventSource.instances[0].onopen?.();

    expect(first.onStatusChange).toHaveBeenLastCalledWith('open');
    expect(second.onStatusChange).toHaveBeenLastCalledWith('open');
  });

  it('delivers each frame as a priced market rate', async () => {
    const { subscribeToLiveRate } = await load();
    const listener = makeListener();
    subscribeToLiveRate(listener);

    FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify({ bid: 6950, ask: 7000 }) });

    expect(listener.onTick).toHaveBeenCalledTimes(1);
    const rate = listener.onTick.mock.calls[0][0];
    expect(rate.mcxBaseRateInr).toBe(7000);
    expect(rate.pricePerGramInr).toBeCloseTo(7313, 4);
    expect(rate.purityLabel).toBe('24K • 99.99%');
  });

  it('drops ticks that arrive faster than every 250ms', async () => {
    const { subscribeToLiveRate } = await load();
    const listener = makeListener();
    subscribeToLiveRate(listener);
    const source = FakeEventSource.instances[0];

    source.onmessage?.({ data: '7000' });
    now += 100;
    source.onmessage?.({ data: '7001' });
    now += 200;
    source.onmessage?.({ data: '7002' });

    expect(listener.onTick).toHaveBeenCalledTimes(2);
    expect(listener.onTick.mock.calls[1][0].mcxBaseRateInr).toBe(7002);
  });

  it('ignores a frame that has no price', async () => {
    const { subscribeToLiveRate } = await load();
    const listener = makeListener();
    subscribeToLiveRate(listener);

    FakeEventSource.instances[0].onmessage?.({ data: 'keep-alive' });

    expect(listener.onTick).not.toHaveBeenCalled();
  });

  it('shows connecting while the browser retries, and error once it gives up', async () => {
    const { subscribeToLiveRate } = await load();
    const listener = makeListener();
    subscribeToLiveRate(listener);
    const source = FakeEventSource.instances[0];

    source.readyState = FakeEventSource.CONNECTING;
    source.onerror?.();
    expect(listener.onStatusChange).toHaveBeenLastCalledWith('connecting');

    source.readyState = FakeEventSource.CLOSED;
    source.onerror?.();
    expect(listener.onStatusChange).toHaveBeenLastCalledWith('error');
  });

  it('keeps the connection until the last subscriber leaves, then closes it', async () => {
    const { subscribeToLiveRate } = await load();
    const offFirst = subscribeToLiveRate(makeListener());
    const offSecond = subscribeToLiveRate(makeListener());
    const source = FakeEventSource.instances[0];

    offFirst();
    expect(source.close).not.toHaveBeenCalled();

    offSecond();
    expect(source.close).toHaveBeenCalledTimes(1);
  });

  it('stops delivering ticks to a subscriber that has left', async () => {
    const { subscribeToLiveRate } = await load();
    const stays = makeListener();
    const leaves = makeListener();
    subscribeToLiveRate(stays);
    const off = subscribeToLiveRate(leaves);

    off();
    FakeEventSource.instances[0].onmessage?.({ data: '7000' });

    expect(stays.onTick).toHaveBeenCalledTimes(1);
    expect(leaves.onTick).not.toHaveBeenCalled();
  });

  it('opens a new connection when someone subscribes again after a full close', async () => {
    const { subscribeToLiveRate } = await load();
    subscribeToLiveRate(makeListener())();

    subscribeToLiveRate(makeListener());

    expect(FakeEventSource.instances).toHaveLength(2);
  });

  describe('in mock mode', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('simulates an open stream and ticks every two seconds without a real connection', async () => {
      const { subscribeToLiveRate } = await load({ mockMode: true });
      const listener = makeListener();

      const off = subscribeToLiveRate(listener);
      expect(listener.onStatusChange).toHaveBeenLastCalledWith('open');
      expect(FakeEventSource.instances).toHaveLength(0);

      now += 5000;
      jest.advanceTimersByTime(2000);
      expect(listener.onTick).toHaveBeenCalledTimes(1);

      off();
      now += 5000;
      jest.advanceTimersByTime(10000);
      expect(listener.onTick).toHaveBeenCalledTimes(1);
    });
  });
});
