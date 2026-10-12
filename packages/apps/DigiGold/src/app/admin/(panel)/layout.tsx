import { AdminShell } from '@/components/admin/AdminShell/AdminShell';
import { AdminSessionGuard } from '@/components/admin/AdminSessionGuard/AdminSessionGuard';

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSessionGuard>
      <AdminShell>{children}</AdminShell>
    </AdminSessionGuard>
  );
}
