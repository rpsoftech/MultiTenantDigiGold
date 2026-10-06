import { redirect } from 'next/navigation';
import {
  DEFAULT_JEWELLERY_CATEGORY_ID,
  jewelleryCategoryHref,
} from '@/features/marketplace/marketplace.catalogue';

export default function JewelleryPage() {
  redirect(jewelleryCategoryHref(DEFAULT_JEWELLERY_CATEGORY_ID));
}
