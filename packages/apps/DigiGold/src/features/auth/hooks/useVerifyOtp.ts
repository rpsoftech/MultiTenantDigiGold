import { useMutation } from '@tanstack/react-query';
import { authService } from '../auth.service';
import { useAppDispatch } from '@/store/hooks';
import {
  registrationStarted,
  sessionEstablished,
} from '@/store/session/session.slice';
import { setRegistrationToken } from '@/lib/auth/tokenStorage';
import { decodeJwtPayload } from '@/lib/utils/jwt';
import { getStoredKycStatus } from '@/features/kyc/kyc-status-storage';

type UserAccessTokenClaims = { user_uuid: string };

export function useVerifyOtp() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: (result, variables) => {
      if (result.is_registered && result.access_token) {
        const claims = decodeJwtPayload<UserAccessTokenClaims>(result.access_token);
        const userId = claims?.user_uuid ?? '';
        dispatch(
          sessionEstablished({
            userId,
            role: 'customer',
            mobileNumber: variables.mobileNumber,
            isNewUser: false,
            kycStatus: getStoredKycStatus(userId),
          }),
        );
      } else if (result.registration_token) {
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
