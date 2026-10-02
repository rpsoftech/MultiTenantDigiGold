import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { subscribeToLiveRate } from './market.sse';

const originalBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
const originalMockFlag = process.env.NEXT_PUBLIC_USE_MOCK_MARKET;
const originalEventSource = globalThis.EventSource;
let unsubscribe: (() => void) | undefined;
const close = jest.fn();
const createEventSource = jest.fn(() => ({
  close,
  onmessage: null as ((event: MessageEvent<string>) => void) | null,
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_USE_MOCK_MARKET = 'false';
  globalThis.EventSource = createEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
  globalThis.EventSource = originalEventSource;
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
  for (const [key, value] of [
    ['NEXT_PUBLIC_API_BASE_URL', originalBaseURL],
    ['NEXT_PUBLIC_USE_MOCK_MARKET', originalMockFlag],
  ]) {
    if (value === undefined) delete process.env[key as string];
    else process.env[key as string] = value;
  }
});

describe('live rate stream URL', () => {
  it.each([
    'http://localhost:8080',
    'http://localhost:8080/api',
    'http://localhost:8080/api/v1',
    'http://localhost:8080/api/v1/',
  ])('uses the same versioned API path for %s', (baseURL) => {
    process.env.NEXT_PUBLIC_API_BASE_URL = baseURL;
    jest.isolateModules(() => {
      const stream = require('./market.sse') as {
        subscribeToLiveRate: typeof subscribeToLiveRate;
      };
      unsubscribe = stream.subscribeToLiveRate({
        onTick: jest.fn(),
        onStatusChange: jest.fn(),
      });
    });

    expect(createEventSource).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/rates/stream',
    );
    unsubscribe?.();
    expect(close).toHaveBeenCalledTimes(1);
    unsubscribe = undefined;
  });
});

describe('mock live rate stream', () => {
  it('shares sample ticks without EventSource and stops after the final subscriber leaves', () => {
    process.env.NEXT_PUBLIC_USE_MOCK_MARKET = 'true';
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const firstTick = jest.fn();
    const secondTick = jest.fn();
    const firstStatus = jest.fn();
    const secondStatus = jest.fn();
    let unsubscribeFirst!: () => void;
    let unsubscribeSecond!: () => void;

    jest.isolateModules(() => {
      const stream = require('./market.sse') as {
        subscribeToLiveRate: typeof subscribeToLiveRate;
      };
      unsubscribeFirst = stream.subscribeToLiveRate({
        onTick: firstTick,
        onStatusChange: firstStatus,
      });
      unsubscribeSecond = stream.subscribeToLiveRate({
        onTick: secondTick,
        onStatusChange: secondStatus,
      });
      unsubscribe = () => {
        unsubscribeFirst();
        unsubscribeSecond();
      };
    });

    expect(createEventSource).not.toHaveBeenCalled();
    expect(firstStatus).toHaveBeenLastCalledWith('open');
    expect(secondStatus).toHaveBeenLastCalledWith('open');
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(2_000);
    expect(firstTick).toHaveBeenCalledTimes(1);
    expect(secondTick).toHaveBeenCalledTimes(1);
    expect(firstTick).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pricePerGramInr: 7120.83,
        purityLabel: '24K • 99.99%',
      }),
    );

    unsubscribeFirst();
    jest.advanceTimersByTime(2_000);
    expect(firstTick).toHaveBeenCalledTimes(1);
    expect(secondTick).toHaveBeenCalledTimes(2);

    unsubscribeSecond();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(4_000);
    expect(secondTick).toHaveBeenCalledTimes(2);
    expect(createEventSource).not.toHaveBeenCalled();
  });
});

describe('live quote stream', () => {
  it.each([
    ['{"last-high":7200,"bid":7000,"ask":7100}', 7100, 7000, 7100],
    ['data: {"bid":7000,"ask":7100}\n\n', 7100, 7000, 7100],
    ['{"ask":7100}', 7100, null, 7100],
    ['{"bid":"7000","ask":7100}', 7100, null, 7100],
    ['7120.83', 7120.83, null, null],
    ['{"bid":7000}', null, null, null],
    ['{"bid":7000,"ask":0}', null, null, null],
  ])(
    'preserves validated quote sides from each frame: %s',
    (frame, expectedPrice, expectedBid, expectedAsk) => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8080';
      const onTick = jest.fn();
      jest.isolateModules(() => {
        const stream = require('./market.sse') as {
          subscribeToLiveRate: typeof subscribeToLiveRate;
        };
        unsubscribe = stream.subscribeToLiveRate({
          onTick,
          onStatusChange: jest.fn(),
        });
      });

      createEventSource.mock.results[0].value.onmessage?.(
        new MessageEvent('message', { data: frame }),
      );

      if (expectedPrice === null) {
        expect(onTick).not.toHaveBeenCalled();
      } else {
        expect(onTick).toHaveBeenCalledTimes(1);
        expect(onTick).toHaveBeenCalledWith({
          pricePerGramInr: expectedPrice,
          bidPerGramInr: expectedBid,
          askPerGramInr: expectedAsk,
          purityLabel: '24K • 99.99%',
          updatedAt: expect.any(String),
        });
      }
    },
  );
});
