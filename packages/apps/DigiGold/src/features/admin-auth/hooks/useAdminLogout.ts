import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { sessionCleared } from '@/store/session/session.slice';
import { clearTokens } from '@/lib/auth/tokenStorage';
import { ROUTES } from '@/lib/constants/routes';

export function useAdminLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  return () => {
    clearTokens();
    dispatch(sessionCleared());
    router.push(ROUTES.adminLogin);
  };
}
