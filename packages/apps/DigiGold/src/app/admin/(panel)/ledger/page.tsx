import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { StoreLedgerPanel } from '@/components/admin/StoreLedgerPanel/StoreLedgerPanel';

export default function AdminLedgerPage() {
  return (
    <StoreAccessGate>
      <StoreLedgerPanel />
    </StoreAccessGate>
  );
}
