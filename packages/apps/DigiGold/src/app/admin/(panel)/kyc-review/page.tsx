import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { KycReviewQueue } from '@/components/admin/KycReviewQueue/KycReviewQueue';

export default function AdminKycReviewPage() {
  return (
    <StoreAccessGate>
      <KycReviewQueue />
    </StoreAccessGate>
  );
}
