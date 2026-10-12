import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';

// /admin has no page of its own: the panel opens on the dashboard (which sends a signed-out
// visitor to the admin login).
export default function AdminIndex() {
  redirect(ROUTES.adminDashboard);
}
