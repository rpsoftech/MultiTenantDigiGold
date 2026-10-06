import { useMutation } from '@tanstack/react-query';
import { authService } from '../auth.service';

export function useRequestOtp() {
  return useMutation({ mutationFn: authService.requestOtp });
}
