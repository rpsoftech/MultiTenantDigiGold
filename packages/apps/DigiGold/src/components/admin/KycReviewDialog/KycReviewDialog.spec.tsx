import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PendingKycSubmission } from '@/features/admin/admin.types';
import { KycReviewDialog } from './KycReviewDialog';

jest.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));

const submission: PendingKycSubmission = {
  userId: 'customer-1',
  name: 'Asha Rao',
  mobileNumber: '9876543210',
  email: 'asha@example.com',
  city: 'Pune',
  goldBalanceGrams: 1.25,
  documents: { panNumber: 'ABCDE1234F', aadhaarLast4: '4821', other: [] },
};

const onDecide = jest.fn();
const onClose = jest.fn();

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof KycReviewDialog>> = {},
) {
  return render(
    <KycReviewDialog
      submission={submission}
      pendingDecision={null}
      error={null}
      onDecide={onDecide}
      onClose={onClose}
      {...overrides}
    />,
  );
}

beforeEach(() => jest.clearAllMocks());
afterEach(cleanup);

describe('KycReviewDialog', () => {
  it('renders nothing when there is no submission', () => {
    renderDialog({ submission: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the customer and the submitted documents, masking Aadhaar', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('+91 98765 43210')).toBeTruthy();
    expect(screen.getByText('Pune')).toBeTruthy();
    expect(screen.getByText('ABCDE1234F')).toBeTruthy();
    expect(screen.getByText('XXXX XXXX 4821')).toBeTruthy();
  });

  it('flags missing documents and optional contact fields as not provided', () => {
    renderDialog({
      submission: {
        ...submission,
        email: undefined,
        city: undefined,
        documents: { other: [] },
      },
    });
    expect(screen.getAllByText('Not provided')).toHaveLength(4);
  });

  it('shows unknown extra document fields', () => {
    renderDialog({
      submission: {
        ...submission,
        documents: {
          ...submission.documents,
          other: [{ label: 'voter id', value: 'XYZ123' }],
        },
      },
    });
    expect(screen.getByText('voter id')).toBeTruthy();
    expect(screen.getByText('XYZ123')).toBeTruthy();
  });

  it('requires a confirmation step before approving', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onDecide).not.toHaveBeenCalled();
    expect(screen.getByText('Approve this KYC?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
    expect(onDecide).toHaveBeenCalledWith('verified');
  });

  it('warns that rejection needs a resubmission and confirms before rejecting', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText('Reject this KYC?')).toBeTruthy();
    expect(screen.getByText(/submit their details again/)).toBeTruthy();
    expect(onDecide).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(onDecide).toHaveBeenCalledWith('rejected');
  });

  it('goes back from the confirmation to the details without deciding', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Review KYC submission')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
    expect(onDecide).not.toHaveBeenCalled();
  });

  it('shows a request error inside the dialog', () => {
    renderDialog({ error: 'Network request failed' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Network request failed',
    );
  });

  it('locks the dialog while a decision is in flight', () => {
    const { rerender } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    rerender(
      <KycReviewDialog
        submission={submission}
        pendingDecision="verified"
        error={null}
        onDecide={onDecide}
        onClose={onClose}
      />,
    );
    expect(
      (screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the details step', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
