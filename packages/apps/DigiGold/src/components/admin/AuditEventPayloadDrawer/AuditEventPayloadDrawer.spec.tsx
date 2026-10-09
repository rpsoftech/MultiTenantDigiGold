import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import type { AuditEvent } from '@/features/admin/admin.types';
import {
  AuditEventPayloadDrawer,
  formatPayload,
} from './AuditEventPayloadDrawer';

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const event: AuditEvent = {
  id: 'evt-1',
  key: 'key-1',
  tenantId: 'tenant-uuid',
  eventName: 'MARGIN_UPDATED',
  isProcessed: true,
  parentNames: ['TenantConfigUpdated', 'Other'],
  payload: { oldMargin: 2.5, nested: { ok: true } },
  ipAddress: '1.2.3.4',
  adminId: 'adm-1',
  occurredAt: '2026-10-09T10:00:00Z',
};

function setClipboard(writeText: jest.Mock) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('AuditEventPayloadDrawer', () => {
  it('stays closed without an event', () => {
    renderWithProviders(<AuditEventPayloadDrawer event={null} onClose={jest.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the metadata and pretty-printed payload', () => {
    renderWithProviders(<AuditEventPayloadDrawer event={event} onClose={jest.fn()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('adm-1')).toBeTruthy();
    expect(screen.getByText('1.2.3.4')).toBeTruthy();
    expect(screen.getByText('Processed')).toBeTruthy();
    expect(screen.getByText('TenantConfigUpdated, Other')).toBeTruthy();
    expect(screen.getByLabelText('Event payload').textContent).toBe(
      JSON.stringify(event.payload, null, 2),
    );
  });

  it('shows placeholders for missing values and hides Copy without a payload', () => {
    renderWithProviders(
      <AuditEventPayloadDrawer
        event={{
          ...event,
          payload: null,
          adminId: undefined,
          ipAddress: undefined,
          parentNames: [],
          isProcessed: false,
        }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Event payload').textContent).toBe('No payload');
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('renders primitive payloads', () => {
    renderWithProviders(
      <AuditEventPayloadDrawer event={{ ...event, payload: 'plain text' }} onClose={jest.fn()} />,
    );
    expect(screen.getByLabelText('Event payload').textContent).toBe('"plain text"');
  });

  it('copies the payload to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    renderWithProviders(<AuditEventPayloadDrawer event={event} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(event.payload, null, 2)),
    );
    expect(await screen.findByText('Payload copied')).toBeTruthy();
  });

  it('reports when copying fails', async () => {
    setClipboard(jest.fn().mockRejectedValue(new Error('denied')));
    renderWithProviders(<AuditEventPayloadDrawer event={event} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText('Couldn’t copy the payload')).toBeTruthy();
  });

  it('calls onClose when dismissed', () => {
    const onClose = jest.fn();
    renderWithProviders(<AuditEventPayloadDrawer event={event} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('formatPayload', () => {
  it('handles null, undefined and circular values', () => {
    expect(formatPayload(null)).toBe('No payload');
    expect(formatPayload(undefined)).toBe('No payload');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatPayload(circular)).toBe('[object Object]');
  });
});
