import { AuditAccessGate } from '@/components/admin/AuditAccessGate/AuditAccessGate';
import { AuditEventsPanel } from '@/components/admin/AuditEventsPanel/AuditEventsPanel';

export default function AdminAuditEventsPage() {
  return (
    <AuditAccessGate>
      <AuditEventsPanel />
    </AuditAccessGate>
  );
}
