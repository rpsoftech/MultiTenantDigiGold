'use client';

import { useState } from 'react';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid/AdminStatsGrid';
import { UserApprovalsTable } from '@/components/admin/UserApprovalsTable/UserApprovalsTable';
import { TransactionLogPanel } from '@/components/admin/TransactionLogPanel/TransactionLogPanel';

export default function AdminDashboardPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <>
      <AdminStatsGrid />
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
