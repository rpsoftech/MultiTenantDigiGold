import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { UserApprovalsTable } from '@/components/admin/UserApprovalsTable/UserApprovalsTable';

export default function AdminCustomersPage() {
  return (
    <StoreAccessGate>
      <UserApprovalsTable />
    </StoreAccessGate>
  );
}
