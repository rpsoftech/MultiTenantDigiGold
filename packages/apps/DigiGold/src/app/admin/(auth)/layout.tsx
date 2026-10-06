import { AuthShell } from '@/components/auth/AuthShell/AuthShell';

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
