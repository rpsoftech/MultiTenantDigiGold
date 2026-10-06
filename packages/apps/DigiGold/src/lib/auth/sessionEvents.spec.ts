import { emitSessionExpired, onSessionExpired } from './sessionEvents';

describe('sessionEvents', () => {
  it('notifies every subscriber when the session expires', () => {
    const first = jest.fn();
    const second = jest.fn();
    const offFirst = onSessionExpired(first);
    const offSecond = onSessionExpired(second);

    emitSessionExpired();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
  });

  it('stops notifying after unsubscribing', () => {
    const handler = jest.fn();
    const off = onSessionExpired(handler);

    off();
    emitSessionExpired();

    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when nobody is listening', () => {
    expect(() => emitSessionExpired()).not.toThrow();
  });
});
