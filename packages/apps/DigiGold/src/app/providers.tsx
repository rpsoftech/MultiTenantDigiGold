'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resolveTenantConfig } from '@/features/tenant/tenant.service';
import { makeStore } from '@/store';
import { tenantConfigReceived } from '@/store/tenant/tenant.slice';
import { sessionEstablished, sessionCleared } from '@/store/session/session.slice';
import { applyTenantTheme } from '@/features/tenant/applyTenantTheme';
import { restoreSessionUser } from '@/features/auth/session-restore';
import { onSessionExpired } from '@/lib/auth/sessionEvents';
import { ToastProvider } from '@/components/common/Toast/Toast';
import { ROUTES } from '@/lib/constants/routes';
import type { TenantConfig } from '@/features/tenant/tenant.types';
import type { AppStore } from '@/store';

type ProvidersProps = {
  children: React.ReactNode;
  initialTenantConfig: TenantConfig;
};

function TenantThemeSync({ config }: { config: TenantConfig }) {
  useEffect(() => {
    // Keeps the static default theme reactive when the browser resolves a tenant config.
    applyTenantTheme(config);
  }, [config]);

  return null;
}

// Runs once per store: rehydrates the logged-in user from a stored access token after a
// full page refresh (deferred to an effect, not the useState initializer, so the first
// client render still matches the server-rendered logged-out HTML and avoids a hydration
// mismatch — same pattern TenantThemeSync/tenant config already uses), and listens for
// apiClient signaling that the session is no longer valid (expired token, backend 401).
function SessionLifecycle({ store }: { store: AppStore }) {
  const router = useRouter();

  useEffect(() => {
    const restoredUser = restoreSessionUser();
    if (restoredUser) store.dispatch(sessionEstablished(restoredUser));

    return onSessionExpired(() => {
      store.dispatch(sessionCleared());
      router.push(ROUTES.login);
    });
  }, [store, router]);

  return null;
}

export function Providers({ children, initialTenantConfig }: ProvidersProps) {
  // Start with the static default, then replace it after the browser resolves the host.
  const [store] = useState(() =>
    makeStore({ tenant: { config: initialTenantConfig } })
  );
  const [queryClient] = useState(() => new QueryClient());
  const [tenantConfig, setTenantConfig] = useState(initialTenantConfig);

  useEffect(() => {
    let cancelled = false;

    void resolveTenantConfig()
      .then((config) => {
        if (cancelled) return;
        setTenantConfig(config);
        store.dispatch(tenantConfigReceived(config));
      })
      .catch(() => {
        // Keep the build-time default theme when the tenant API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [store]);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TenantThemeSync config={tenantConfig} />
          <SessionLifecycle store={store} />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}
