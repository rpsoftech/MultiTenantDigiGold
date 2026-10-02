import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { sessionCleared } from '@/store/session/session.slice';
import { clearStoredTokens } from '@/lib/auth/tokenStorage';
import { ROUTES } from '@/lib/constants/routes';
import { useQueryClient } from '@tanstack/react-query';

export function useAdminLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    dispatch(sessionCleared());
    // Clearing the slice alone is not a sign-out: the JWT survives in localStorage and the
    // Providers bootstrap would restore the session on the next page load.
    clearStoredTokens();
    // Drop cached admin/portfolio data so the next sign-in can't render the previous
    // tenant's numbers while its queries refetch.
    queryClient.clear();
    router.push(ROUTES.adminLogin);
  };
}
