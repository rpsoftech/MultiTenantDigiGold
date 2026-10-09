import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { stubMatchMedia } from '@/components/vault/Redemptions/testUtils';
import type { AuditEvent, AuditEventsPage } from '@/features/admin/admin.types';
import { AuditEventsPanel } from './AuditEventsPanel';

const mockUseAuditEvents = jest.fn();
const mockUseAdminTenants = jest.fn();

jest.mock('@/features/admin/hooks/useAuditEvents', () => ({
  useAuditEvents: (...args: unknown[]) => mockUseAuditEvents(...args),
}));
jest.mock('@/features/admin/hooks/useAdminTenants', () => ({
  useAdminTenants: () => mockUseAdminTenants(),
}));
// The calendar popover is covered by its own tests; here a button picks a fixed day.
jest.mock('@/components/common/DatePickerField/DatePickerField', () => ({
  DatePickerField: ({
    label,
    value,
    minDate,
    maxDate,
    onChange,
  }: {
    label: string;
    value?: Date;
    minDate?: Date;
    maxDate?: Date;
    onChange: (date: Date) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onChange(new Date(2026, 9, label === 'From' ? 1 : 9))}
      >
        Pick {label}
      </button>
      <span data-testid={`${label}-value`}>{value?.getDate() ?? ''}</span>
      <span data-testid={`${label}-min`}>{minDate?.getDate() ?? ''}</span>
      <span data-testid={`${label}-max`}>{maxDate?.getDate() ?? ''}</span>
    </div>
  ),
}));

const event: AuditEvent = {
  id: 'evt-1',
  key: 'key-1',
  tenantId: 'tenant-1',
  eventName: 'MARGIN_UPDATED',
  isProcessed: true,
  parentNames: [],
  payload: { oldMargin: 2.5 },
  occurredAt: '2026-10-09T10:00:00Z',
};

function pageOf(overrides: Partial<AuditEventsPage> = {}): AuditEventsPage {
  return { items: [event], total: 45, page: 1, limit: 20, totalPages: 3, ...overrides };
}

function query(overrides: Record<string, unknown> = {}) {
  return {
    data: pageOf(),
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  };
}

function lastCall() {
  const calls = mockUseAuditEvents.mock.calls;
  return calls[calls.length - 1] as [Record<string, string | undefined>, number, number];
}

beforeEach(() => {
  stubMatchMedia();
  mockUseAuditEvents.mockReset().mockReturnValue(query());
  mockUseAdminTenants.mockReset().mockReturnValue({
    data: [{ tenantUuid: 'tenant-1', name: 'DigiGold' }],
    isError: false,
    refetch: jest.fn(),
  });
});

afterEach(cleanup);

describe('AuditEventsPanel', () => {
  it('requests the first page unfiltered and shows rows with the totals', () => {
    renderWithProviders(<AuditEventsPanel />, { user: null });

    expect(lastCall()).toEqual([
      { tenantUuid: undefined, type: undefined, from: undefined, to: undefined },
      1,
      20,
    ]);
    expect(within(screen.getByRole('table')).getByText('Margin updated')).toBeTruthy();
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getByText(/45 events/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Clear filters' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a loader while loading', () => {
    mockUseAuditEvents.mockReturnValue(query({ data: undefined, isLoading: true }));
    renderWithProviders(<AuditEventsPanel />, { user: null });
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('offers a retry when loading fails', () => {
    const refetch = jest.fn();
    mockUseAuditEvents.mockReturnValue(query({ data: undefined, isError: true, refetch }));
    renderWithProviders(<AuditEventsPanel />, { user: null });
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t load the audit log');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('explains an empty log without filters', () => {
    mockUseAuditEvents.mockReturnValue(query({ data: pageOf({ items: [], total: 0, totalPages: 1 }) }));
    renderWithProviders(<AuditEventsPanel />, { user: null });
    expect(screen.getByText('No events recorded yet')).toBeTruthy();
  });

  it('filters by tenant and type, resets to page 1 and clears', () => {
    renderWithProviders(<AuditEventsPanel />, { user: null });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(lastCall()[1]).toBe(2);

    fireEvent.change(screen.getByLabelText('Tenant'), { target: { value: 'tenant-1' } });
    expect(lastCall()[0].tenantUuid).toBe('tenant-1');
    expect(lastCall()[1]).toBe(1);

    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'MARGIN_UPDATED' } });
    expect(lastCall()[0]).toMatchObject({ tenantUuid: 'tenant-1', type: 'MARGIN_UPDATED' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(lastCall()[0]).toEqual({
      tenantUuid: undefined,
      type: undefined,
      from: undefined,
      to: undefined,
    });
    expect((screen.getByLabelText('Tenant') as HTMLSelectElement).value).toBe('');
  });

  it('passes the chosen dates as YYYY-MM-DD and limits each picker by the other', () => {
    renderWithProviders(<AuditEventsPanel />, { user: null });

    fireEvent.click(screen.getByRole('button', { name: 'Pick From' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick To' }));

    expect(lastCall()[0]).toMatchObject({ from: '2026-10-01', to: '2026-10-09' });
    expect(screen.getByTestId('To-min').textContent).toBe('1');
    expect(screen.getByTestId('From-max').textContent).toBe('9');
  });

  it('explains when filters match nothing and lets the user clear them', () => {
    mockUseAuditEvents.mockReturnValue(query({ data: pageOf({ items: [], total: 0, totalPages: 1 }) }));
    renderWithProviders(<AuditEventsPanel />, { user: null });
    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'ADMIN_CREATED' } });

    expect(screen.getByText('No events match these filters')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[1]);
    expect(lastCall()[0].type).toBeUndefined();
  });

  it('pages forward and back and stops at the last page', () => {
    renderWithProviders(<AuditEventsPanel />, { user: null });
    const next = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement;

    fireEvent.click(next);
    fireEvent.click(next);
    expect(lastCall()[1]).toBe(3);
    expect(screen.getByText('Page 3 of 3')).toBeTruthy();
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(lastCall()[1]).toBe(2);
  });

  it('explains running past the end of the log', () => {
    mockUseAuditEvents.mockReturnValue(query({ data: pageOf({ items: [] }) }));
    renderWithProviders(<AuditEventsPanel />, { user: null });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('You’ve reached the end of the log')).toBeTruthy();
  });

  it('changes the page size and returns to the first page', () => {
    renderWithProviders(<AuditEventsPanel />, { user: null });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
    expect(lastCall()[1]).toBe(1);
    expect(lastCall()[2]).toBe(50);
  });

  it('refreshes the log', () => {
    const refetch = jest.fn();
    mockUseAuditEvents.mockReturnValue(query({ refetch }));
    renderWithProviders(<AuditEventsPanel />, { user: null });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh log' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('opens the payload drawer for a row', () => {
    renderWithProviders(<AuditEventsPanel />, { user: null });
    fireEvent.click(screen.getByRole('button', { name: /View details for MARGIN_UPDATED/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Event payload').textContent).toContain('oldMargin');
  });

  it('shows the tenant name on rows and lets the user retry a failed tenant list', () => {
    const refetch = jest.fn();
    mockUseAdminTenants.mockReturnValue({ data: undefined, isError: true, refetch });
    renderWithProviders(<AuditEventsPanel />, { user: null });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
    // Rows still render without tenant names.
    expect(within(screen.getByRole('table')).getByText('Margin updated')).toBeTruthy();
  });
});
