import { MainShell } from '@/components/main/MainShell/MainShell';

// Public pages: no session guard, so they open directly for visitors who are not logged in.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <MainShell>{children}</MainShell>;
}
