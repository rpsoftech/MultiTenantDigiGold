import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '@/store/hooks';
import { sessionCleared } from '@/store/session/session.slice';
import { clearTokens } from '@/lib/auth/tokenStorage';
import { ROUTES } from '@/lib/constants/routes';

export function useAdminLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    clearTokens();
    dispatch(sessionCleared());
    queryClient.clear();
    router.push(ROUTES.adminLogin);
  };
}
