import { waitFor } from '@testing-library/react';
import { renderHookWithProviders, customerUser } from '@/test-utils/renderWithProviders';
import { useSessionGate } from './useSessionGate';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
}));

describe('useSessionGate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is ready once the session check settles for a signed-in customer', async () => {
    const { result } = renderHookWithProviders(() => useSessionGate(), { user: customerUser });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.user?.userId).toBe('user-1');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a visitor without a session to login and never becomes ready', async () => {
    const { result } = renderHookWithProviders(() => useSessionGate(), { user: null });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(result.current.isReady).toBe(false);
  });
});
