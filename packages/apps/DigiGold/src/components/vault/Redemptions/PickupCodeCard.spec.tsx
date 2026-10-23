import { act, fireEvent, render, screen } from '@testing-library/react';
import { PickupCodeCard } from './PickupCodeCard';

function mockClipboard(writeText: jest.Mock) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('PickupCodeCard', () => {
  it('shows the code and the counter instruction', () => {
    render(<PickupCodeCard code="123456" />);

    expect(screen.getByText('123456')).toBeTruthy();
    expect(
      screen.getByText(/show this code at the store counter/i),
    ).toBeTruthy();
  });

  it('hides the instruction in compact mode', () => {
    render(<PickupCodeCard code="123456" compact />);

    expect(screen.getByText('123456')).toBeTruthy();
    expect(
      screen.queryByText(/show this code at the store counter/i),
    ).toBeNull();
  });

  it('copies the code and confirms, then resets the label', async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<PickupCodeCard code="123456" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    });

    expect(writeText).toHaveBeenCalledWith('123456');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    jest.useRealTimers();
  });

  it('says so, and points at the code, when the clipboard is unavailable', async () => {
    jest.useFakeTimers();
    mockClipboard(jest.fn().mockRejectedValue(new Error('denied')));
    render(<PickupCodeCard code="123456" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    });

    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'Tap the code to select it, then copy.',
    );
    // The code itself is still on screen to read out or copy by hand.
    expect(screen.getByText('123456')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    jest.useRealTimers();
  });
});
