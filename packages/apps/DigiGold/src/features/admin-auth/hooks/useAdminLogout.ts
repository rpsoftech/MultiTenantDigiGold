import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '@/store/hooks';
import { adminSessionCleared } from '@/store/session/session.slice';
import { ROUTES } from '@/lib/constants/routes';
import { clearAdminTokens, getAdminRefreshToken } from '@/lib/api/admin-tokens';
import { adminAuthService } from '@/features/admin-auth/admin-auth.service';

export function useAdminLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    // Revoke server-side too: clearing localStorage alone left a copied refresh token
    // usable until it expired. Fire-and-forget so logout never waits on the network, and
    // read the token before clearing it below. Nothing here may stop the local sign-out.
    const refreshToken = getAdminRefreshToken();
    Promise.resolve()
      .then(() => adminAuthService.logout(refreshToken))
      .catch(() => undefined);
    clearAdminTokens();
    void queryClient.cancelQueries({ queryKey: ['admin'] });
    queryClient.removeQueries({ queryKey: ['admin'] });
    dispatch(adminSessionCleared());
    router.replace(ROUTES.adminLogin);
  };
}
