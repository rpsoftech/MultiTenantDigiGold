'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OtpForm } from '@/components/auth/OtpForm/OtpForm';
import { ROUTES } from '@/lib/constants/routes';
import { MOBILE_NUMBER_PATTERN } from '@/lib/constants/regex';

export default function AdminOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobileNumber = searchParams.get('mobile') ?? '';
  const isValidMobile = MOBILE_NUMBER_PATTERN.test(mobileNumber);

  useEffect(() => {
    if (!isValidMobile) {
      router.replace(ROUTES.adminLogin);
    }
  }, [isValidMobile, router]);

  if (!isValidMobile) return null;

  return (
    <OtpForm
      mobileNumber={mobileNumber}
      successRoute={ROUTES.adminDashboard}
      loginRoute={ROUTES.adminLogin}
    />
  );
}
