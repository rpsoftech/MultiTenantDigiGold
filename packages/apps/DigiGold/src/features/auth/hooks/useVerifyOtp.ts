import { useMutation } from '@tanstack/react-query';
import { authService } from '../auth.service';
import { useAppDispatch } from '@/store/hooks';
import {
  registrationStarted,
  sessionEstablished,
} from '@/store/session/session.slice';

export function useVerifyOtp() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: (result, variables) => {
      if (result.is_registered && result.access_token) {
        dispatch(
          sessionEstablished({
            userId: '',
            role: 'customer',
            mobileNumber: variables.mobileNumber,
            isNewUser: false,
            kycStatus: 'not_started',
          }),
        );
      } else if (result.registration_token) {
        window.sessionStorage.setItem(
          'registration_token',
          result.registration_token,
        );
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
