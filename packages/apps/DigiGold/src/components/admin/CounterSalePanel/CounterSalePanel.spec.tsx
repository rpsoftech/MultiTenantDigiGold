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
const mockQuote = jest.fn();
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
let mockQuoteState: { isPending: boolean };

jest.mock('@/features/market/hooks/useLiveRate', () => ({
  useLiveRate: () => mockLive,
}));
jest.mock('@/features/admin/hooks/useCustomerPicker', () => ({
  useCustomerPicker: () => mockPicker,
}));
jest.mock('@/features/admin/hooks/useCounterQuote', () => ({
  useCounterQuote: () => ({
    ...mockQuoteState,
    mutate: mockQuote,
    reset: jest.fn(),
  }),
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
const aarav = {
  ...priya,
  userId: 'customer-3',
  name: 'Aarav Shah',
  mobileNumber: '9000000003',
  kycStatus: 'rejected',
};

// The store's own price, which differs from the feed's ₹7,500 estimate.
const quote = {
  quoteId: 'quote-1',
  paymentMode: 'COUNTER_CASH',
  weightGrams: 0.1026,
  amountInr: 750,
  ratePerGram: 7313,
  mcxBaseRate: 7000,
  marginPerGramInr: 100,
  gstPerGramInr: 213,
  expiresAt: Date.now() + 5 * 60 * 1000,
};

const receipt = {
  id: 'gl-1',
  eventType: 'GOLD_PURCHASE',
  paymentMode: 'COUNTER_CASH',
  weightGrams: 0.1,
  amountInr: 750,
  ratePerGram: 7500,
  mcxBaseRate: 7000,
  marginPerGramInr: 100,
  gstPerGramInr: 213,
  runningGoldBalanceGrams: 2.1,
  createdAt: '2026-10-05T10:00:00Z',
  alreadyRecorded: false,
};

type Callbacks<T> = {
  onSuccess: (result: T) => void;
  onError: (error: unknown) => void;
};

function quoteFails(error: unknown) {
  mockQuote.mockImplementation((_request, options: Callbacks<unknown>) =>
    options.onError(error),
  );
}

function confirmFails(error: unknown) {
  mockMutate.mockImplementation((_quoteId, options: Callbacks<unknown>) =>
    options.onError(error),
  );
}

beforeEach(() => {
  stubMatchMedia();
  mockMutate.mockReset();
  mockQuote.mockReset();
  mockQuote.mockImplementation((_request, options: Callbacks<typeof quote>) =>
    options.onSuccess({ ...quote, expiresAt: Date.now() + 5 * 60 * 1000 }),
  );
  mockShowToast.mockReset();
  mockFetchNextPage.mockReset();
  mockTradeState = { isPending: false };
  mockQuoteState = { isPending: false };
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
    customers: [priya, rohan, aarav],
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
    expect(screen.getByText(/KYC is not approved yet/)).toBeTruthy();
    next();
    expect(screen.getByLabelText('Amount in rupees')).toBeTruthy();
  });

  it('calls out a customer whose KYC was rejected', () => {
    render(<CounterSalePanel />);
    pickCustomer('Aarav Shah');
    expect(screen.getByText(/KYC was rejected/)).toBeTruthy();
    expect(screen.queryByText(/KYC is not approved yet/)).toBeNull();
  });

  it('moves on from the sale details before the first rate arrives', () => {
    mockLive = { data: null, status: 'connecting' };
    render(<CounterSalePanel />);
    toPayment();
    expect(screen.getByRole('button', { name: 'UPI' })).toBeTruthy();
  });

  it('prices an amount sale on the server and shows the store’s exact price', () => {
    render(<CounterSalePanel />);
    toPayment();
    fireEvent.click(screen.getByRole('button', { name: 'UPI' }));
    review();

    expect(mockQuote.mock.calls[0][0]).toEqual({
      userId: 'customer-1',
      paymentMode: 'COUNTER_UPI',
      amountInr: 750,
    });
    const dialog = screen.getByRole('dialog');
    // The server's grams and rate, not the feed estimate (0.1000 g at ₹7,500).
    expect(within(dialog).getByText('0.1026 g')).toBeTruthy();
    expect(within(dialog).getByText(/7,313\.00/)).toBeTruthy();
    expect(within(dialog).getByText(/Price held until/)).toBeTruthy();
  });

  it('prices only the grams when entering by weight', () => {
    render(<CounterSalePanel />);
    toDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Weight (grams)' }));
    enter('2.5');
    next();
    review();

    expect(mockQuote.mock.calls[0][0]).toEqual({
      userId: 'customer-1',
      paymentMode: 'COUNTER_CASH',
      weightGrams: 2.5,
    });
  });

  it('confirms the sale by its quote alone', () => {
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(mockMutate.mock.calls[0][0]).toBe('quote-1');
  });

  it('shows the receipt after a successful sale and starts a new one', () => {
    mockMutate.mockImplementation(
      (_quoteId, options: Callbacks<typeof receipt>) =>
        options.onSuccess(receipt),
    );
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(screen.getByText('Counter sale receipt')).toBeTruthy();
    expect(screen.getByText('gl-1')).toBeTruthy();
    expect(screen.getByText('2.1000 g')).toBeTruthy();
    expect(screen.queryByText(/already been recorded/)).toBeNull();
    expect(mockShowToast).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
    expect(screen.getByText('Select a customer')).toBeTruthy();
  });

  it('says so when the sale had already been recorded by an earlier attempt', () => {
    mockMutate.mockImplementation(
      (_quoteId, options: Callbacks<typeof receipt>) =>
        options.onSuccess({ ...receipt, alreadyRecorded: true }),
    );
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(screen.getByText(/already been recorded/)).toBeTruthy();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sale was already recorded' }),
    );
  });

  it('lets the cashier confirm again after a lost reply, which is safe', () => {
    confirmFails({ status: null, code: 'ECONNABORTED', message: 'timeout' });
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert').textContent).toMatch(
      /may already be recorded.*never recorded twice/,
    );
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Confirm sale',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('asks for a new price when the held one has expired', () => {
    confirmFails({
      status: 409,
      code: 'COUNTER_QUOTE_EXPIRED',
      message: 'expired',
    });
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/This price has expired/)).toBeTruthy();
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Confirm sale',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Get a new price' }),
    );
    expect(mockQuote).toHaveBeenCalledTimes(2);
    expect(mockQuote.mock.calls[1][0]).toEqual(mockQuote.mock.calls[0][0]);
    expect(screen.queryByText(/This price has expired/)).toBeNull();
  });

  it('marks the price expired once its time is up', () => {
    mockQuote.mockImplementation((_request, options: Callbacks<typeof quote>) =>
      options.onSuccess({ ...quote, expiresAt: Date.now() - 1 }),
    );
    render(<CounterSalePanel />);
    toPayment();
    review();

    expect(screen.getByText(/This price has expired/)).toBeTruthy();
  });

  it('sends the cashier to UPI when cash would reach the legal limit', () => {
    quoteFails({
      status: 400,
      code: 'CASH_LIMIT_EXCEEDED',
      message: 'Cash received from this customer today would reach ₹2,00,000.',
    });
    render(<CounterSalePanel />);
    toPayment('250000');
    review();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/₹2,00,000/);
    expect(screen.getByRole('button', { name: 'UPI' })).toBeTruthy();
  });

  it('closes the dialog when the cash limit is reached at confirmation', () => {
    confirmFails({
      status: 400,
      code: 'CASH_LIMIT_EXCEEDED',
      message: 'Cash received from this customer today would reach ₹2,00,000.',
    });
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/₹2,00,000/);
  });

  it('explains a pricing failure without opening the dialog', () => {
    quoteFails({
      status: 409,
      code: 'CREDIT_LIMIT_EXCEEDED',
      message: 'This store cannot accept the trade right now.',
    });
    render(<CounterSalePanel />);
    toPayment();
    review();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByText('This store cannot accept the trade right now.'),
    ).toBeTruthy();
  });

  it('keeps the dialog open with the server message for other failures', () => {
    confirmFails({
      status: 409,
      code: 'COUNTER_SALE_IN_PROGRESS',
      message: 'This sale is still being recorded.',
    });
    render(<CounterSalePanel />);
    toPayment();
    review();
    confirm();

    expect(
      within(screen.getByRole('dialog')).getByText(
        'This sale is still being recorded.',
      ),
    ).toBeTruthy();
  });

  it('returns to the customer step when the server says they no longer exist', () => {
    confirmFails({
      status: 404,
      code: 'ERROR_USER_NOT_FOUND',
      message: 'nope',
    });
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
    expect(screen.getByText(/KYC is not approved yet/)).toBeTruthy();
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
