import { useMutation } from '@tanstack/react-query';
import { authService } from '../auth.service';
import { useAppDispatch } from '@/store/hooks';
import {
  registrationStarted,
  sessionEstablished,
} from '@/store/session/session.slice';
import { clearTokens, setRegistrationToken } from '@/lib/auth/tokenStorage';
import { decodeJwtPayload } from '@/lib/utils/jwt';

type UserAccessTokenClaims = { user_uuid: string };

export function useVerifyOtp() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: (result, variables) => {
      if (result.is_registered && result.access_token) {
        const claims = decodeJwtPayload<UserAccessTokenClaims>(
          result.access_token,
        );
        dispatch(
          sessionEstablished({
            userId: claims?.user_uuid ?? '',
            role: 'customer',
            mobileNumber: variables.mobileNumber,
            isNewUser: false,
            kycStatus: 'not_started',
          }),
        );
      } else if (result.registration_token) {
        // A new number has no session yet. Drop any earlier customer's tokens: verifyOtp
        // stores only the tokens it gets (none here), and on reload a leftover session would
        // be restored instead of this registration.
        clearTokens();
        setRegistrationToken(result.registration_token);
        dispatch(
          registrationStarted({
            token: result.registration_token,
            phone: variables.mobileNumber,
          }),
        );
      }
    },
  });
}
