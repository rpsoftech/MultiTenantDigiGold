import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '@/store/hooks';
import { sessionCleared } from '@/store/session/session.slice';
import { clearTokens, clearRegistrationToken } from '@/lib/auth/tokenStorage';
import { ROUTES } from '@/lib/constants/routes';

export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    clearTokens();
    clearRegistrationToken();
    dispatch(sessionCleared());
    // Cached per-user data (trade history, portfolio) would otherwise be shown to the
    // next account that signs in on this browser until its own refetch lands.
    queryClient.clear();
    router.push(ROUTES.login);
  };
}
