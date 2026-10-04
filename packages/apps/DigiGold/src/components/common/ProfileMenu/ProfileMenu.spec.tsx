import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store';
import { ProfileMenu } from './ProfileMenu';

jest.mock('@/features/auth/hooks/useLogout', () => ({ useLogout: () => jest.fn() }));

// Radix's popper measures its anchor with ResizeObserver, which jsdom doesn't implement.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  };
});

afterEach(cleanup);

describe('ProfileMenu', () => {
  it('closes itself and notifies its container when the KYC link is used', async () => {
    const onNavigate = jest.fn();
    render(
      <Provider store={makeStore()}>
        <ProfileMenu onNavigate={onNavigate} />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    // Radix keeps the popper visibility:hidden until it measures its position, which never
    // happens in jsdom — so role queries (which skip hidden elements) can't see it; use text.
    const kycLink = screen.getByText('KYC Verification').closest('a');
    expect(kycLink?.getAttribute('href')).toBe('/kyc');

    fireEvent.click(kycLink as HTMLAnchorElement);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('KYC Verification')).toBeNull());
  });
});
