import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAuthService } from '../admin-auth.service';
import { adminSessionUser } from '../admin-session';
import { clearAdminTokens } from '@/lib/api/admin-tokens';
import { useAppDispatch } from '@/store/hooks';
import { sessionEstablished } from '@/store/session/session.slice';

export function useAdminTotpVerify() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminAuthService.verifyTotp,
    gcTime: 0,
    onSuccess: (tokens) => {
      try {
        const user = adminSessionUser(tokens.access_token);
        queryClient.removeQueries({ queryKey: ['admin'] });
        dispatch(sessionEstablished(user));
      } catch (error) {
        clearAdminTokens();
        throw error;
      }
    },
  });
}
