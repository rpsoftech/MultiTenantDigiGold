import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { CustomerDirectoryTable } from '@/components/admin/CustomerDirectoryTable/CustomerDirectoryTable';

export default function AdminCustomersPage() {
  return (
    <StoreAccessGate>
      <CustomerDirectoryTable />
    </StoreAccessGate>
  );
}
