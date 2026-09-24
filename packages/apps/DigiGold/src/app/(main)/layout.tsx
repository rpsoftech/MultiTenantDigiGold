import { MainShell } from '@/components/main/MainShell/MainShell';

// BottomNav lands in a future step — the Header/Footer shell is wired now with the Home
// Dashboard build-order item.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <MainShell>{children}</MainShell>;
}
