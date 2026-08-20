import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { sessionCleared } from '@/store/session/session.slice';
import { ROUTES } from '@/lib/constants/routes';

export function useAdminLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  return () => {
    dispatch(sessionCleared());
    router.push(ROUTES.adminLogin);
  };
}
