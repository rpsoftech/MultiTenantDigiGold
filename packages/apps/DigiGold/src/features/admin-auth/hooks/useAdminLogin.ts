import { useMutation } from '@tanstack/react-query';
import { adminAuthService } from '../admin-auth.service';
import { useAppDispatch } from '@/store/hooks';
import { sessionEstablished } from '@/store/session/session.slice';

export function useAdminLogin() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: adminAuthService.login,
    onSuccess: (result) => {
      dispatch(sessionEstablished(result.user));
    },
  });
}
