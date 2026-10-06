import { TransactionStatsPanel } from '@/components/admin/TransactionStatsPanel/TransactionStatsPanel';
import { RecentTransactionsTable } from '@/components/admin/RecentTransactionsTable/RecentTransactionsTable';
import { RecentUsersTable } from '@/components/admin/RecentUsersTable/RecentUsersTable';

export default function AdminDashboardPage() {
  return (
    <>
      <TransactionStatsPanel />
      <RecentTransactionsTable />
      <RecentUsersTable />
    </>
  );
}
