import { act, render, screen } from '@testing-library/react';
import { CountdownTimer } from './CountdownTimer';

// The hook re-arms its timer after each render, so time must pass one second at a time.
function tick(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
}

describe('CountdownTimer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('formats the remaining time as mm:ss', () => {
    render(<CountdownTimer seconds={125} />);

    expect(screen.getByText('02:05')).toBeTruthy();
  });

  it('pads single digits', () => {
    render(<CountdownTimer seconds={7} />);

    expect(screen.getByText('00:07')).toBeTruthy();
  });

  it('ticks down every second', () => {
    render(<CountdownTimer seconds={30} />);

    tick(3);

    expect(screen.getByText('00:27')).toBeTruthy();
  });

  it('calls onExpire once when it reaches zero', () => {
    const onExpire = jest.fn();
    render(<CountdownTimer seconds={2} onExpire={onExpire} />);

    tick(2);

    expect(screen.getByText('00:00')).toBeTruthy();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('announces updates politely to screen readers', () => {
    render(<CountdownTimer seconds={5} />);

    expect(screen.getByText('00:05').getAttribute('aria-live')).toBe('polite');
  });
});
