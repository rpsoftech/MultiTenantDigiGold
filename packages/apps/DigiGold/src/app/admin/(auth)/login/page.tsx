import { LoginForm } from '@/components/auth/LoginForm/LoginForm';
import { ROUTES } from '@/lib/constants/routes';

export default function AdminLoginPage() {
  return <LoginForm successRoute={ROUTES.adminDashboard} />;
}
