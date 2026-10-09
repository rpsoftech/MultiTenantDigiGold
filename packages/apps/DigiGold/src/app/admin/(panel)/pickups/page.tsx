import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { PendingPickupsPanel } from '@/components/admin/PendingPickupsPanel/PendingPickupsPanel';

export default function AdminPickupsPage() {
  return (
    <StoreAccessGate>
      <PendingPickupsPanel />
    </StoreAccessGate>
  );
}
