import { Suspense } from 'react';
import { ProductDetail } from '@/components/jewellery/ProductDetail/ProductDetail';

// The product id comes from ?id= and is read on the client (useSearchParams), so the
// static export has one product page that works for any product — including ones added
// after the build — and never fetches catalogue data at build time.
export default function JewelleryProductPage() {
  return (
    <Suspense fallback={null}>
      <ProductDetail />
    </Suspense>
  );
}
