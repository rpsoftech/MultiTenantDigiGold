import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { sessionCleared } from '@/store/session/session.slice';
import { clearTokens, clearRegistrationToken } from '@/lib/auth/tokenStorage';
import { ROUTES } from '@/lib/constants/routes';

export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  return () => {
    clearTokens();
    clearRegistrationToken();
    dispatch(sessionCleared());
    router.push(ROUTES.login);
  };
}
