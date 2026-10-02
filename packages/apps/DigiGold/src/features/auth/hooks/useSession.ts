import { useAppSelector } from '@/store/hooks';
import {
  selectSessionUser,
  selectIsAuthenticated,
  selectSessionRevision,
} from '@/store/session/session.slice';

export function useSession() {
  const user = useAppSelector(selectSessionUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const sessionRevision = useAppSelector(selectSessionRevision);

  return { user, isAuthenticated, sessionRevision };
}
