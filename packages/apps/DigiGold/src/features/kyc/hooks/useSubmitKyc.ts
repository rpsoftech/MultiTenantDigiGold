import { useMutation } from '@tanstack/react-query';
import { kycService } from '../kyc.service';
import { setStoredKycStatus } from '../kyc-status-storage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { kycStatusUpdated, selectSessionUser } from '@/store/session/session.slice';

export function useSubmitKyc() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectSessionUser);

  return useMutation({
    mutationFn: kycService.submitKyc,
    // The server always moves the user to "pending" on a successful submit.
    onSuccess: () => {
      if (user?.userId) setStoredKycStatus(user.userId, 'pending');
      dispatch(kycStatusUpdated('pending'));
    },
  });
}
