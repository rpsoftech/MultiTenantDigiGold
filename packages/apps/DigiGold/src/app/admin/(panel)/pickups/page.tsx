import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { PendingPickupsPanel } from '@/components/admin/PendingPickupsPanel/PendingPickupsPanel';
import { CollectedTodayTable } from '@/components/admin/CollectedTodayTable/CollectedTodayTable';

export default function AdminPickupsPage() {
  return (
    <StoreAccessGate>
      <PendingPickupsPanel />
      <CollectedTodayTable />
    </StoreAccessGate>
  );
}
