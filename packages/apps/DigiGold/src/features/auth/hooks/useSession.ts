import { useAppSelector } from '@/store/hooks';
import { selectSessionUser, selectIsAuthenticated } from '@/store/session/session.slice';

export function useSession() {
  const user = useAppSelector(selectSessionUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return { user, isAuthenticated };
}
