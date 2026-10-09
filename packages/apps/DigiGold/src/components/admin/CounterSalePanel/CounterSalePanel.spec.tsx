import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { stubMatchMedia } from '@/components/vault/Redemptions/testUtils';
import { CounterSalePanel } from './CounterSalePanel';

const mockMutate = jest.fn();
const mockShowToast = jest.fn();
const mockFetchNextPage = jest.fn();
let mockLive: {
  data: {
    pricePerGramInr: number;
    mcxBaseRateInr: number;
    marginAppliedInr: number;
    gstAppliedInr: number;
  } | null;
  status: string;
};
let mockPicker: Record<string, unknown>;
let mockTradeState: { isPending: boolean };

jest.mock('@/features/market/hooks/useLiveRate', () => ({
  useLiveRate: () => mockLive,
}));
jest.mock('@/features/admin/hooks/useCustomerPicker', () => ({
  useCustomerPicker: () => mockPicker,
}));
jest.mock('@/features/admin/hooks/useCounterTrade', () => ({
  useCounterTrade: () => ({
    ...mockTradeState,
    mutate: mockMutate,
    reset: jest.fn(),
  }),
}));
jest.mock('@/components/common/Toast/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const priya = {
  userId: 'customer-1',
  name: 'Priya Patel',
  mobileNumber: '9123456789',
  goldBalanceGrams: 2,
  kycStatus: 'verified',
  joinedAt: '2026-01-01T00:00:00.000Z',
};
const rohan = {
  ...priya,
  userId: 'customer-2',
  name: 'Rohan Verma',
  mobileNumber: '9988776655',
  kycStatus: 'pending',
};

const receipt = {
  id: 'gl-1',
  eventType: 'GOLD_PURCHASE',
  paymentMode: 'COUNTER_CASH',
  weightGrams: 0.1,
  amountInr: 750,
  ratePerGram: 7500,
  mcxBaseRate: 7000,
  marginInr: 100,
  gstInr: 213,
  runningGoldBalanceGrams: 2.1,
  createdAt: '2026-10-05T10:00:00Z',
};

beforeEach(() => {
  stubMatchMedia();
  mockMutate.mockReset();
  mockShowToast.mockReset();
  mockFetchNextPage.mockReset();
  mockTradeState = { isPending: false };
  mockLive = {
    data: {
      pricePerGramInr: 7500,
      mcxBaseRateInr: 7000,
      marginAppliedInr: 100,
      gstAppliedInr: 213,
    },
    status: 'open',
  };
  mockPicker = {
    customers: [priya, rohan],
    isLoading: false,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: mockFetchNextPage,
    refetch: jest.fn(),
  };
});

afterEach(cleanup);

function openCustomers() {
  fireEvent.click(screen.getByRole('button', { name: /Customer/ }));
}

function pickCustomer(name = 'Priya Patel') {
  openCustomers();
  fireEvent.click(
    within(screen.getByRole('list', { name: 'Customers' })).getByRole(
      'button',
      { name: new RegExp(name) },
    ),
  );
}

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

// Step 1 done, now on "Sale details".
function toDetails(name?: string) {
  pickCustomer(name);
  next();
}

function enter(value: string) {
  fireEvent.change(screen.getByLabelText(/Amount in rupees|Weight in grams/), {
    target: { value },
  });
}

// Customer chosen and amount entered, now on "Payment".
function toPayment(value = '750') {
  toDetails();
  enter(value);
  next();
}

function review() {
  fireEvent.click(screen.getByRole('button', { name: 'Review sale' }));
}

function confirm() {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Confirm sale',
    }),
  );
}

describe('CounterSalePanel', () => {
  it('shows the live rate and its breakdown', () => {
    render(<CounterSalePanel />);
    expect(screen.getByText(/7,500\.00/)).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('starts on the customer step and shows one step at a time', () => {
    render(<CounterSalePanel />);
    expect(screen.getByText('Select a customer')).toBeTruthy();
    expect(screen.queryByLabelText('Amount in rupees')).toBeNull();
    expect(screen.queryByRole('button', { name: 'UPI' })).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('filters customers by the search text', () => {
    render(<CounterSalePanel />);
    openCustomers();
    fireEvent.change(screen.getByLabelText('Search customers'), {
      target: { value: '9988' },
    });
    expect(screen.queryByText('Priya Patel')).toBeNull();
    expect(screen.getByText('Rohan Verma')).toBeTruthy();
  });

  it('loads more customers on demand', () => {
    mockPicker.hasNextPage = true;
    render(<CounterSalePanel />);
    openCustomers();
    fireEvent.click(
      screen.getByRole('button', { name: 'Load more customers' }),
    );
    expect(mockFetchNextPage).toHaveBeenCalled();
  });

  it('will not move past the customer step until one is chosen', () => {
    render(<CounterSalePanel />);
    next();
    expect(screen.getByText('Select the customer buying gold.')).toBeTruthy();
    expect(screen.queryByLabelText('Amount in rupees')).toBeNull();
  });

  it('will not move past the sale details without a valid amount', () => {
    render(<CounterSalePanel />);
    toDetails();
    next();
    expect(screen.getByText('Enter an amount greater than zero.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'UPI' })).toBeNull();
  });

  it('sends the cashier back to the customer step when reviewing without one', () => {
    render(<CounterSalePanel />);
    review();
    expect(screen.getByText('Select the customer buying gold.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends the cashier back to the sale details when reviewing without an amount', () => {
    render(<CounterSalePanel />);
    pickCustomer();
    review();
    expect(screen.getByText('Enter an amount greater than zero.')).toBeTruthy();
  });

  it('goes back to an earlier step and keeps what was entered', () => {
    render(<CounterSalePanel />);
    toPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      (screen.getByLabelText('Amount in rupees') as HTMLInputElement).value,
    ).toBe('750');
  });

  it('adds quick-add steps to the typed amount', () => {
    render(<CounterSalePanel />);
    toDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1000 rupees' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 500 rupees' }));
    expect(
      (screen.getByLabelText('Amount in rupees') as HTMLInputElement).value,
    ).toBe('1500');
  });

  it('adds quick-add grams without floating point noise', () => {
    render(<CounterSalePanel />);
    toDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Weight (grams)' }));
    enter('0.1');
    fireEvent.click(screen.getByRole('button', { name: 'Add 0.5 grams' }));
    expect(
      (screen.getByLabelText('Weight in grams') as HTMLInputElement).value,
    ).toBe('0.6');
  });

  it('shows the gold and amount totals for the entered sale', () => {
    render(<CounterSalePanel />);
    toDetails();
    enter('750');
    expect(screen.getByText('0.1000 g')).toBeTruthy();
    expect(screen.getByText('₹750.00')).toBeTruthy();
  });

  it('rejects more decimals than the server keeps', () => {
    render(<CounterSalePanel />);
    toDetails();
    enter('100.123');
    next();
    expect(
      screen.getByText('Amounts can have at most 2 decimal places.'),
    ).toBeTruthy();
  });

  it('rejects an amount too small to buy any gold', () => {
    render(<CounterSalePanel />);
    toDetails();
    enter('0.01');
    next();
    expect(screen.getByText(/too small to buy any gold/)).toBeTruthy();
  });

  it('warns, but does not block, a customer without approved KYC', () => {
    render(<CounterSalePanel />);
    pickCustomer('Rohan Verma');
    expect(screen.getByText(/KYC is not approved/)).toBeTruthy();
    next();
    expect(screen.getByLabelText('Amount in rupees')).toBeTruthy();
  });

  it('confirms an amount sale and sends only the amount at the reviewed rate', () => {
    render(<CounterSalePanel />);
    toPayment();
    fireEvent.click(screen.getByRole('button', { name: 'UPI' }));
    review();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('0.1000 g')).toBeTruthy();
    confirm();

    expect(mockMutate.mock.calls[0][0]).toEqual({
      userId: 'customer-1',
      ratePerGram: 7500,
      paymentMode: 'COUNTER_UPI',
      amountInr: 750,
    });
  });

  it('sends only the grams when entering by weight', () => {
    render(<CounterSalePanel />);
    toDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Weight (grams)' }));
    enter('2.5');
    next();
    review();
    confirm();

    expect(mockMutate.mock.calls[0][0]).toEqual({
      userId: 'customer-1',
      ratePerGram: 7500,
      paymentMode: 'COUNTER_CASH',
      weightGrams: 2.5,
    });
  });

  it('shows the receipt after a successful sale and starts a new one', () => {
    mockMutate.mockImplementation(
      (_payload, options: { onSuccess: (r: typeof receipt) => void }) =>
        options.onSuccess(receipt),
    );
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(screen.getByText('Counter sale receipt')).toBeTruthy();
    expect(screen.getByText('gl-1')).toBeTruthy();
    expect(screen.getByText('2.1000 g')).toBeTruthy();
    expect(mockShowToast).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
    expect(screen.getByText('Select a customer')).toBeTruthy();
  });

  it('closes the dialog and explains when the server reports slippage', () => {
    mockMutate.mockImplementation(
      (_payload, options: { onError: (e: unknown) => void }) =>
        options.onError({
          status: 409,
          code: 'SLIPPAGE_EXCEEDED',
          message: 'moved',
        }),
    );
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/live rate moved/);
  });

  it('keeps the dialog open with the server message for other failures', () => {
    mockMutate.mockImplementation(
      (_payload, options: { onError: (e: unknown) => void }) =>
        options.onError({
          status: 409,
          code: 'CREDIT_LIMIT_EXCEEDED',
          message: 'This store cannot accept the trade right now.',
        }),
    );
    render(<CounterSalePanel />);
    toPayment();
    review();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirm sale' }),
    );

    expect(
      within(dialog).getByText('This store cannot accept the trade right now.'),
    ).toBeTruthy();
  });

  it('returns to the customer step when the server says they no longer exist', () => {
    mockMutate.mockImplementation(
      (_payload, options: { onError: (e: unknown) => void }) =>
        options.onError({
          status: 404,
          code: 'ERROR_ENTITY_NOT_FOUND',
          message: 'nope',
        }),
    );
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(screen.getByText(/could not be found in this store/)).toBeTruthy();
    expect(screen.getByText('Select a customer')).toBeTruthy();
  });

  it('lets the cashier change the customer from the same field', () => {
    render(<CounterSalePanel />);
    pickCustomer();
    expect(screen.getByText(/Vault 2\.0000 g/)).toBeTruthy();
    pickCustomer('Rohan Verma');
    expect(screen.getByText(/KYC is not approved/)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Customers' })).toBeNull();
  });

  it('pauses sales while the live rate is disconnected', () => {
    mockLive = { ...mockLive, status: 'closed' };
    render(<CounterSalePanel />);
    expect(
      (screen.getByRole('button', { name: 'Review sale' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/sales are paused/)).toBeTruthy();
  });

  it('pauses sales until the first rate arrives', () => {
    mockLive = { data: null, status: 'connecting' };
    render(<CounterSalePanel />);
    expect(
      (screen.getByRole('button', { name: 'Review sale' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
