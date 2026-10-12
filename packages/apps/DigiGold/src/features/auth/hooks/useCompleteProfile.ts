import { useMutation } from '@tanstack/react-query';
import { authService } from '../auth.service';
import { useAppDispatch } from '@/store/hooks';
import { profileCompleted } from '@/store/session/session.slice';
import { decodeJwtPayload } from '@/lib/utils/jwt';

type UserAccessTokenClaims = { user_uuid?: string };

export function useCompleteProfile() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: authService.completeProfile,
    onSuccess: (result) => {
      const claims = result.access_token
        ? decodeJwtPayload<UserAccessTokenClaims>(result.access_token)
        : null;
      dispatch(profileCompleted({ userId: claims?.user_uuid ?? '' }));
    },
  });
}
