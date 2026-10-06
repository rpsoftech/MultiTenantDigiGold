import { act, renderHook } from '@testing-library/react';
import { useCountdown } from './useCountdown';

// The hook re-arms its timer after each render, so time must pass one second at a time.
function tick(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
}

describe('useCountdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts at the initial value and counts down once per second', () => {
    const { result } = renderHook(() => useCountdown(3));
    expect(result.current.secondsLeft).toBe(3);
    expect(result.current.isExpired).toBe(false);

    tick(1);
    expect(result.current.secondsLeft).toBe(2);

    tick(2);
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('calls onExpire when it reaches zero and stops counting', () => {
    const onExpire = jest.fn();
    const { result } = renderHook(() => useCountdown(2, { onExpire }));

    tick(2);
    expect(onExpire).toHaveBeenCalledTimes(1);

    tick(5);
    expect(result.current.secondsLeft).toBe(0);
  });

  it('expires immediately when it starts at zero', () => {
    const onExpire = jest.fn();
    const { result } = renderHook(() => useCountdown(0, { onExpire }));

    expect(result.current.isExpired).toBe(true);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('can be restarted with the initial value or a custom one', () => {
    const { result } = renderHook(() => useCountdown(5));
    tick(3);
    expect(result.current.secondsLeft).toBe(2);

    act(() => result.current.restart());
    expect(result.current.secondsLeft).toBe(5);

    act(() => result.current.restart(9));
    expect(result.current.secondsLeft).toBe(9);
  });

  it('follows a changed initial value', () => {
    const { result, rerender } = renderHook(
      ({ seconds }) => useCountdown(seconds),
      {
        initialProps: { seconds: 10 },
      },
    );

    rerender({ seconds: 4 });

    expect(result.current.secondsLeft).toBe(4);
  });

  it('stops its timer on unmount', () => {
    const onExpire = jest.fn();
    const { unmount } = renderHook(() => useCountdown(2, { onExpire }));

    unmount();
    tick(5);

    expect(onExpire).not.toHaveBeenCalled();
  });
});
