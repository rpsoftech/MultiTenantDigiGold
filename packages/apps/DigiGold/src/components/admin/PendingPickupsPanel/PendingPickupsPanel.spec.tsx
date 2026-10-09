import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  CollectRedemptionPayload,
  PendingRedemption,
  StorePage,
} from '@/features/admin/admin.types';
import { PendingPickupsPanel } from './PendingPickupsPanel';

jest.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));

const pickup: PendingRedemption = {
  id: 'rdm-1',
  ledgerId: 'gl-1',
  weightGrams: 2.5,
  requestedAt: '2026-10-09T08:00:00Z',
  customerName: 'Asha Rao',
  customerPhone: '9876543210',
};

const refetch = jest.fn();
const queryMock = jest.fn();
const showToast = jest.fn();
let queryState: {
  data?: StorePage<PendingRedemption>;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: typeof refetch;
};

type MutateOptions = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};
const collectMutate = jest.fn<void, [CollectRedemptionPayload, MutateOptions]>();
const cancelMutate = jest.fn<void, [string, MutateOptions]>();
let collectState: { mutate: typeof collectMutate; isPending: boolean };
let cancelState: { mutate: typeof cancelMutate; isPending: boolean };

jest.mock('@/features/admin/hooks/usePendingRedemptions', () => ({
  usePendingRedemptions: (page: number, limit: number, phone: string) => {
    queryMock(page, limit, phone);
    return queryState;
  },
}));
jest.mock('@/features/admin/hooks/useCollectRedemption', () => ({
  useCollectRedemption: () => collectState,
}));
jest.mock('@/features/admin/hooks/useCancelRedemption', () => ({
  useCancelRedemption: () => cancelState,
}));
jest.mock('@/components/common/Toast/Toast', () => ({
  useToast: () => ({ showToast }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryState = {
    data: { items: [pickup], page: 1, limit: 20, hasNextPage: true },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch,
  };
  collectState = { mutate: collectMutate, isPending: false };
  cancelState = { mutate: cancelMutate, isPending: false };
});
afterEach(cleanup);

function openCollect() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Collect pickup for Asha Rao' }),
  );
}

function typeCode(value: string) {
  fireEvent.change(screen.getByLabelText('Pickup code'), {
    target: { value },
  });
}

function codeForm(): HTMLFormElement {
  const form = screen.getByLabelText('Pickup code').closest('form');
  if (!form) throw new Error('Pickup code field is not inside a form');
  return form;
}

function confirmButton() {
  return screen.getByRole<HTMLButtonElement>('button', {
    name: 'Confirm handover',
  });
}

function apiError(status: number, code: string, message = 'server message') {
  return { status, code, message };
}

describe('pending pickups list', () => {
  it('lists the pending pickups with phone, gold and request time', () => {
    render(<PendingPickupsPanel />);
    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('+91 98765 43210')).toBeTruthy();
    expect(screen.getByText('2.5000 g')).toBeTruthy();
    expect(screen.getByText(/09 Oct 2026/)).toBeTruthy();
    expect(queryMock).toHaveBeenLastCalledWith(1, 20, '');
  });

  it('shows an empty state, a loader state and a retryable error', () => {
    queryState.data = { items: [], page: 1, limit: 20, hasNextPage: false };
    const { rerender } = render(<PendingPickupsPanel />);
    expect(screen.getByText('No pending pickups')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();

    queryState = { ...queryState, data: undefined, isLoading: true };
    rerender(<PendingPickupsPanel />);
    expect(
      screen.getByRole('status', { name: 'Loading pending pickups' }),
    ).toBeTruthy();

    queryState = {
      ...queryState,
      data: undefined,
      isLoading: false,
      isError: true,
    };
    rerender(<PendingPickupsPanel />);
    expect(screen.getByRole('alert').textContent).toContain(
      'Pending pickups are unavailable',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('pages forward and back', () => {
    render(<PendingPickupsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(queryMock).toHaveBeenLastCalledWith(2, 20, '');
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(queryMock).toHaveBeenLastCalledWith(1, 20, '');
  });

  it('explains an empty page beyond the first', () => {
    const { rerender } = render(<PendingPickupsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    queryState.data = { items: [], page: 2, limit: 20, hasNextPage: false };
    rerender(<PendingPickupsPanel />);
    expect(screen.getByText('No pickups on this page')).toBeTruthy();
  });
});

describe('search by customer phone', () => {
  function search(value: string) {
    fireEvent.change(screen.getByLabelText('Search by customer mobile'), {
      target: { value },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  }

  it('normalises a pasted number and queries from page one', () => {
    render(<PendingPickupsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(queryMock).toHaveBeenLastCalledWith(2, 20, '');

    search('+91 98765-43210');
    expect(queryMock).toHaveBeenLastCalledWith(1, 20, '9876543210');
    expect(
      (screen.getByLabelText('Search by customer mobile') as HTMLInputElement)
        .value,
    ).toBe('9876543210');
  });

  it('rejects an invalid number inline without querying', () => {
    render(<PendingPickupsPanel />);
    queryMock.mockClear();
    search('12345');
    expect(screen.getByText('Enter a 10-digit mobile number.')).toBeTruthy();
    expect(queryMock).not.toHaveBeenCalledWith(1, 20, '12345');
    expect(
      queryMock.mock.calls.every((call) => call[2] === ''),
    ).toBe(true);
  });

  it('clears the inline error as soon as the user types again', () => {
    render(<PendingPickupsPanel />);
    search('12345');
    fireEvent.change(screen.getByLabelText('Search by customer mobile'), {
      target: { value: '123456' },
    });
    expect(screen.queryByText('Enter a 10-digit mobile number.')).toBeNull();
  });

  it('shows a no-match state with a way back to all pickups', () => {
    const { rerender } = render(<PendingPickupsPanel />);
    search('9123456789');
    queryState.data = { items: [], page: 1, limit: 20, hasNextPage: false };
    rerender(<PendingPickupsPanel />);
    expect(
      screen.getByText('No pending pickups for +91 91234 56789'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show all pickups' }));
    expect(queryMock).toHaveBeenLastCalledWith(1, 20, '');
  });

  it('clears the filter with Clear and with an empty search', () => {
    render(<PendingPickupsPanel />);
    search('9876543210');
    expect(queryMock).toHaveBeenLastCalledWith(1, 20, '9876543210');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(queryMock).toHaveBeenLastCalledWith(1, 20, '');

    search('9876543210');
    search('   ');
    expect(queryMock).toHaveBeenLastCalledWith(1, 20, '');
  });
});

describe('collect with the pickup code', () => {
  it('keeps the confirm button disabled until the code has six digits', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);

    typeCode('12345');
    expect(confirmButton().disabled).toBe(true);
    typeCode('123456');
    expect(confirmButton().disabled).toBe(false);
  });

  it('strips non-digits from the code as the user types or pastes', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('482 915');
    expect((screen.getByLabelText('Pickup code') as HTMLInputElement).value).toBe(
      '482915',
    );
    typeCode('ab12');
    expect((screen.getByLabelText('Pickup code') as HTMLInputElement).value).toBe(
      '12',
    );
  });

  it('sends the redemption id and code, then toasts on success and closes', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('482915');
    fireEvent.click(confirmButton());

    expect(collectMutate).toHaveBeenCalledTimes(1);
    const [payload, options] = collectMutate.mock.calls[0];
    expect(payload).toEqual({ redemptionId: 'rdm-1', pickupCode: '482915' });

    act(() => options.onSuccess?.());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Gold handed over', variant: 'success' }),
    );
  });

  it('submits with Enter in the code field', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('482915');
    fireEvent.submit(codeForm());
    expect(collectMutate).toHaveBeenCalledTimes(1);
  });

  it('does not send an incomplete code even if the form is submitted', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('123');
    fireEvent.submit(codeForm());
    expect(collectMutate).not.toHaveBeenCalled();
  });

  it('handles a wrong code: keeps the dialog, clears the field, shows the error, no toast', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('000000');
    fireEvent.click(confirmButton());
    const { onError } = collectMutate.mock.calls[0][1];

    act(() => onError?.(apiError(400, 'INVALID_PICKUP_CODE')));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/pickup code is incorrect/)).toBeTruthy();
    expect((screen.getByLabelText('Pickup code') as HTMLInputElement).value).toBe(
      '',
    );
    expect(showToast).not.toHaveBeenCalled();

    typeCode('1');
    expect(screen.queryByText(/pickup code is incorrect/)).toBeNull();
  });

  it('closes with an "already completed" toast on a 409', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('482915');
    fireEvent.click(confirmButton());
    const { onError } = collectMutate.mock.calls[0][1];

    act(() => onError?.(apiError(409, 'REDEMPTION_NOT_PENDING')));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Already completed', variant: 'danger' }),
    );
  });

  it('closes with a "not found" toast on a 404', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('482915');
    fireEvent.click(confirmButton());
    const { onError } = collectMutate.mock.calls[0][1];

    act(() => onError?.(apiError(404, 'REDEMPTION_NOT_FOUND')));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pickup not found' }),
    );
  });

  it('keeps the dialog and the typed code on a server error', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('482915');
    fireEvent.click(confirmButton());
    const { onError } = collectMutate.mock.calls[0][1];

    act(() => onError?.(apiError(500, 'UNKNOWN')));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/server is having trouble/)).toBeTruthy();
    expect((screen.getByLabelText('Pickup code') as HTMLInputElement).value).toBe(
      '482915',
    );
  });

  it('backs out of the dialog without sending anything', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(collectMutate).not.toHaveBeenCalled();
  });

  it('forgets a half-typed code when the dialog is reopened', () => {
    render(<PendingPickupsPanel />);
    openCollect();
    typeCode('4829');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    openCollect();
    expect((screen.getByLabelText('Pickup code') as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('blocks a second submission and dismissal while a request is in flight', () => {
    collectState.isPending = true;
    render(<PendingPickupsPanel />);
    openCollect();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Back' }).disabled,
    ).toBe(true);
    expect(confirmButton().disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('cancel a pickup', () => {
  function openCancel() {
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel pickup for Asha Rao' }),
    );
  }

  it('asks for confirmation and sends nothing until confirmed', () => {
    render(<PendingPickupsPanel />);
    openCancel();
    expect(screen.getByText('Cancel this pickup?')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('2.5000 g')).toBeTruthy();
    expect(cancelMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep pickup' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cancelMutate).not.toHaveBeenCalled();
  });

  it('cancels the chosen pickup and toasts that the gold went back', () => {
    render(<PendingPickupsPanel />);
    openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel pickup' }));

    expect(cancelMutate).toHaveBeenCalledTimes(1);
    const [id, options] = cancelMutate.mock.calls[0];
    expect(id).toBe('rdm-1');

    act(() => options.onSuccess?.());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Pickup cancelled',
        description: expect.stringContaining('returned to Asha Rao'),
      }),
    );
  });

  it('closes with a toast when the pickup was already completed (409)', () => {
    render(<PendingPickupsPanel />);
    openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel pickup' }));
    const { onError } = cancelMutate.mock.calls[0][1];

    act(() => onError?.(apiError(409, 'REDEMPTION_NOT_PENDING')));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Already completed' }),
    );
  });

  it('keeps the dialog open with the error on a server failure', () => {
    render(<PendingPickupsPanel />);
    openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel pickup' }));
    const { onError } = cancelMutate.mock.calls[0][1];

    act(() => onError?.(apiError(500, 'UNKNOWN')));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'server is having trouble',
    );
  });

  it('disables the row actions while a cancellation is running', () => {
    cancelState.isPending = true;
    render(<PendingPickupsPanel />);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Collect pickup for Asha Rao',
      }).disabled,
    ).toBe(true);
  });
});
