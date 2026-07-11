import { useMutation } from '@tanstack/react-query';
import { authService } from '../auth.service';
import { useAppDispatch } from '@/store/hooks';
import { profileCompleted } from '@/store/session/session.slice';

export function useCompleteProfile() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: authService.completeProfile,
    onSuccess: () => {
      dispatch(profileCompleted());
    },
  });
}
