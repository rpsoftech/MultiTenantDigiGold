'use client';

import { useState } from 'react';
import { TransactionStatsPanel } from '@/components/admin/TransactionStatsPanel/TransactionStatsPanel';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid/AdminStatsGrid';
import { RecentTransactionsTable } from '@/components/admin/RecentTransactionsTable/RecentTransactionsTable';
import { RecentUsersTable } from '@/components/admin/RecentUsersTable/RecentUsersTable';
import { UserApprovalsTable } from '@/components/admin/UserApprovalsTable/UserApprovalsTable';
import { TransactionLogPanel } from '@/components/admin/TransactionLogPanel/TransactionLogPanel';

export default function AdminDashboardPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <>
      <TransactionStatsPanel />
      <AdminStatsGrid />
      <RecentTransactionsTable />
      <RecentUsersTable />
      <UserApprovalsTable
        selectedUserId={selectedUserId}
        onViewLogs={(userId) =>
          setSelectedUserId((current) => (current === userId ? null : userId))
        }
      />
      {selectedUserId && (
        <TransactionLogPanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </>
  );
}
