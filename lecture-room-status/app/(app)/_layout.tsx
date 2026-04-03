import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { PolicyProvider } from '@/src/context/PolicyContext';

export default function AppLayout() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.force_password_change) return <Redirect href="/change-password" />;

  return (
    <PolicyProvider>
      <Slot />
    </PolicyProvider>
  );
}
