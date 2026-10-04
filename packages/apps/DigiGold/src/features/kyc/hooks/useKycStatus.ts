import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/hooks/useSession';
import type { KycStatus } from '@/store/session/session.types';
import { kycService } from '../kyc.service';

export const KYC_STATUS_QUERY_KEY = ['user', 'kyc'] as const;

// The customer's KYC status, straight from MainServer. It lives in React Query rather than
// the session slice because an admin can change it at any time: refetching on window
// focus is how a customer sees an approval without signing out and back in.
// `status` is undefined until the server answers — callers must not treat that as
// 'not_started', or a verified customer would be blocked while it loads.
export function useKycStatus(): {
  status: KycStatus | undefined;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
} {
  const { isAuthenticated, user } = useSession();
  const query = useQuery({
    queryKey: KYC_STATUS_QUERY_KEY,
    queryFn: kycService.getStatus,
    select: (result) => result.kyc_status,
    enabled: isAuthenticated && user?.role === 'customer',
  });

  return {
    status: query.data,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
  };
}
