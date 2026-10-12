import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { TransactionStatsPanel } from '@/components/admin/TransactionStatsPanel/TransactionStatsPanel';
import { RecentTransactionsTable } from '@/components/admin/RecentTransactionsTable/RecentTransactionsTable';
import { RecentUsersTable } from '@/components/admin/RecentUsersTable/RecentUsersTable';

export default function AdminDashboardPage() {
  return (
    <StoreAccessGate>
      <TransactionStatsPanel />
      <RecentTransactionsTable />
      <RecentUsersTable />
    </StoreAccessGate>
  );
}
