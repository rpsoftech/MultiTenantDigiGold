import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AuditEvent } from '@/features/admin/admin.types';
import { AuditEventsTable } from './AuditEventsTable';

afterEach(cleanup);

const event: AuditEvent = {
  id: 'evt-1',
  key: 'key-1',
  tenantId: 'tenant-uuid',
  eventName: 'MARGIN_UPDATED',
  isProcessed: false,
  parentNames: [],
  payload: { a: 1 },
  ipAddress: '1.2.3.4',
  adminId: 'adm-1',
  occurredAt: '2026-10-09T10:00:00Z',
};

describe('AuditEventsTable', () => {
  it('shows a labelled row per event with tenant name, actor and IP', () => {
    render(
      <AuditEventsTable
        events={[event, { ...event, id: 'evt-2', adminId: undefined, ipAddress: undefined }]}
        tenantNames={{ 'tenant-uuid': 'DigiGold' }}
        onView={jest.fn()}
      />,
    );
    expect(screen.getAllByText('Margin updated')).toHaveLength(2);
    expect(screen.getAllByText('DigiGold')).toHaveLength(2);
    expect(screen.getByText('adm-1')).toBeTruthy();
    expect(screen.getByText('1.2.3.4')).toBeTruthy();
    expect(screen.getAllByText('Pending')).toHaveLength(2);
    // Stacked-table layout needs a data-label on every cell.
    document.querySelectorAll('tbody td').forEach((cell) => {
      expect(cell.getAttribute('data-label')).toBeTruthy();
    });
  });

  it('falls back to a dash when the tenant name is unknown', () => {
    render(<AuditEventsTable events={[event]} onView={jest.fn()} />);
    expect(screen.getByText('tenant-uuid')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('opens the details for the chosen event', () => {
    const onView = jest.fn();
    render(<AuditEventsTable events={[event]} onView={onView} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'View details for MARGIN_UPDATED event evt-1',
      }),
    );
    expect(onView).toHaveBeenCalledWith(event);
  });
});
