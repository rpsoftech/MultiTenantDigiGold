'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/common/Modal/Modal';
import { BUY_GOLD_SECTION_ID, BuyGold } from '@/components/dashboard/BuyGold/BuyGold';
import { useSession } from '@/features/auth/hooks/useSession';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { ROUTES } from '@/lib/constants/routes';

// Blocks that start a purchase (the hero CTA, the Buy quick action) scroll to the Buy Gold
// section when the page has one; that section handles sign-in itself. A published layout
// need not include it, so without one they open the same purchase card in a dialog, and a
// signed-out visitor is sent to sign in first.
export function useBuyAction(): {
  canBuy: boolean;
  startBuy: () => void;
  buyDialog: ReactNode;
} {
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const tradingEnabled = useTenantConfig()?.activeModules.trading ?? true;
  const [open, setOpen] = useState(false);

  const startBuy = useCallback(() => {
    const section = document.getElementById(BUY_GOLD_SECTION_ID);
    if (section) {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      section.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      // Move keyboard and screen reader focus along with the scroll.
      section.focus({ preventScroll: true });
      return;
    }
    if (isAuthenticated) setOpen(true);
    else router.push(ROUTES.login);
  }, [isAuthenticated, router]);

  // Only mounted while open, so the purchase card's rate and quote logic never runs for
  // visitors who don't use it.
  const buyDialog = open ? (
    <Modal open onOpenChange={setOpen} title="Buy gold" size="lg">
      <BuyGold embedded />
    </Modal>
  ) : null;

  return { canBuy: tradingEnabled, startBuy, buyDialog };
}
