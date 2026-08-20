import { useMutation } from '@tanstack/react-query';
import { authService } from '../auth.service';
import { useAppDispatch } from '@/store/hooks';
import { sessionEstablished } from '@/store/session/session.slice';

export function useVerifyOtp() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: (result) => {
      dispatch(sessionEstablished(result.user));
    },
  });
}
