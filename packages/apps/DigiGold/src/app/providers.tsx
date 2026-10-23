'use client';

import { ToastProvider, useToast } from '@/components/common/Toast/Toast';
import {
  restoreRegistration,
  restoreSessionUser,
} from '@/features/auth/session-restore';
import { applyTenantTheme } from '@/features/tenant/applyTenantTheme';
import { resolveTenantConfig } from '@/features/tenant/tenant.service';
import type { TenantConfig } from '@/features/tenant/tenant.types';
import { onSessionExpired } from '@/lib/auth/sessionEvents';
import { ROUTES } from '@/lib/constants/routes';
import type { AppStore } from '@/store';
import { makeStore } from '@/store';
import {
  registrationStarted,
  sessionCleared,
  sessionEstablished,
} from '@/store/session/session.slice';
import {
  tenantConfigReceived,
  tenantConfigUnavailable,
} from '@/store/tenant/tenant.slice';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';

type ProvidersProps = {
  children: React.ReactNode;
  initialTenantConfig: TenantConfig;
};

function TenantThemeSync({ fallback }: { fallback: TenantConfig }) {
  const config = useTenantConfig() ?? fallback;

  useEffect(() => {
    // Keeps the static default theme reactive when the browser resolves a tenant config.
    applyTenantTheme(config);
  }, [config]);

  return null;
}

export const TENANT_CONFIG_QUERY_KEY = ['tenant', 'config'] as const;
// A published layout reaches an open storefront within this window (or sooner, when the
// tab regains focus).
export const TENANT_CONFIG_REFETCH_MS = 60_000;

// Reads the tenant on mount and keeps re-reading it, so publishing a new layout (or theme)
// reaches customers already on the page. Query structural sharing keeps `data` referentially
// stable while nothing changed, so an unchanged poll dispatches nothing and re-renders nothing.
function TenantConfigSync({ store }: { store: AppStore }) {
  const { data, isError } = useQuery({
    queryKey: TENANT_CONFIG_QUERY_KEY,
    queryFn: resolveTenantConfig,
    refetchInterval: TENANT_CONFIG_REFETCH_MS,
    refetchOnWindowFocus: true,
    // The tenant call already has its own short timeout; retrying on top would hold the home
    // page on its loading state well past it. The next poll or tab focus tries again.
    retry: false,
  });

  useEffect(() => {
    if (data) store.dispatch(tenantConfigReceived(data));
  }, [data, store]);

  useEffect(() => {
    // Keep the build-time default (and any layout already read) when the tenant API is
    // unavailable; the flag only lets the homepage stop waiting on a layout that won't come.
    if (isError) store.dispatch(tenantConfigUnavailable());
  }, [isError, store]);

  return null;
}

// Runs once per store: rehydrates the logged-in user from a stored access token after a
// full page refresh (deferred to an effect, not the useState initializer, so the first
// client render still matches the server-rendered logged-out HTML and avoids a hydration
// mismatch — same pattern TenantThemeSync/tenant config already uses), and listens for
// apiClient signaling that the session is no longer valid (expired token, backend 401).
function SessionLifecycle({ store }: { store: AppStore }) {
  const router = useRouter();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const restoredUser = restoreSessionUser();
    if (restoredUser) {
      store.dispatch(sessionEstablished(restoredUser));
    } else {
      const registration = restoreRegistration();
      if (registration) store.dispatch(registrationStarted(registration));
    }

    return onSessionExpired((reason) => {
      const { isAuthenticated } = store.getState().session;
      store.dispatch(sessionCleared());
      // Same reason as useLogout: don't leave this user's cached data for the next login.
      if (isAuthenticated) queryClient.clear();

      // Concurrent 401s each fire this event — only the first, which still sees a live
      // session, tells the user why they were signed out.
      if (isAuthenticated) {
        showToast({
          variant: 'danger',
          title: 'Session expired',
          description: 'Please sign in again to continue.',
        });
      }

      if (reason === 'rejected') {
        // Only customer routes raise this event (admin 401s refresh or emit
        // 'admin-session-expired', handled by AdminSessionGuard), so it's always the
        // customer login.
        router.push(ROUTES.login);
      }
    });
  }, [store, router, showToast, queryClient]);

  return null;
}

export function Providers({ children, initialTenantConfig }: ProvidersProps) {
  // Start with the static default, then replace it after the browser resolves the host.
  const [store] = useState(() =>
    makeStore({ tenant: { config: initialTenantConfig, resolved: false } }),
  );
  const [queryClient] = useState(() => new QueryClient());

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TenantThemeSync fallback={initialTenantConfig} />
          <TenantConfigSync store={store} />
          <SessionLifecycle store={store} />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}
