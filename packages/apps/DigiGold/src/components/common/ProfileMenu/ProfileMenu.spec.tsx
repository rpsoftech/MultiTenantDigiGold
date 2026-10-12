import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store';
import { ProfileMenu } from './ProfileMenu';

const logoutMock = jest.fn();
jest.mock('@/features/auth/hooks/useLogout', () => ({ useLogout: () => logoutMock }));

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

  // The popover closes by unmounting: signing out removes the menu from the header.
  it('logs out from the popover', () => {
    logoutMock.mockClear();
    const onNavigate = jest.fn();
    render(
      <Provider store={makeStore()}>
        <ProfileMenu onNavigate={onNavigate} />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    // Hidden popper again: find the entry by text.
    fireEvent.click(screen.getByText('Logout').closest('button') as HTMLButtonElement);

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  // Inside the mobile nav (a modal dialog) a popover would render behind it, so the entries
  // are shown directly, without needing a trigger click.
  it('inline: shows KYC and Logout without a trigger and runs their handlers', () => {
    const onNavigate = jest.fn();
    logoutMock.mockClear();
    render(
      <Provider store={makeStore()}>
        <ProfileMenu inline onNavigate={onNavigate} />
      </Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'KYC Verification' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
