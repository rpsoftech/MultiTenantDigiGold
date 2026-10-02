import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from 'react-redux';
import type { RootState } from '@/store';
import { sessionCleared } from '@/store/session/session.slice';
import { ROUTES } from '@/lib/constants/routes';
import { clearAdminTokens } from '@/lib/api/admin-tokens';

export function useAdminLogout() {
  const store = useStore<RootState>();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    clearAdminTokens();
    void queryClient.cancelQueries({ queryKey: ['admin'] });
    queryClient.removeQueries({ queryKey: ['admin'] });
    if (store.getState().session.user?.role === 'admin') {
      store.dispatch(sessionCleared());
    }
    router.replace(ROUTES.adminLogin);
  };
}
