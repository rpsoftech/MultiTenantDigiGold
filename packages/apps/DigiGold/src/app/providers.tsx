'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resolveTenantConfig } from '@/features/tenant/tenant.service';
import { resolveTenantFromHost } from '@/lib/utils/resolveTenantFromHost';
import { makeStore } from '@/store';
import { tenantConfigReceived } from '@/store/tenant/tenant.slice';
import { applyTenantTheme } from '@/features/tenant/applyTenantTheme';
import { ToastProvider } from '@/components/common/Toast/Toast';
import type { TenantConfig } from '@/features/tenant/tenant.types';

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

export function Providers({ children, initialTenantConfig }: ProvidersProps) {
  // Start with the static default, then replace it after the browser resolves the host.
  const [store] = useState(() =>
    makeStore({ tenant: { config: initialTenantConfig } })
  );
  const [queryClient] = useState(() => new QueryClient());
  const [tenantConfig, setTenantConfig] = useState(initialTenantConfig);

  useEffect(() => {
    const defaultTenant =
      process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? 'aurelian-digital';
    const retailerCode = resolveTenantFromHost(window.location.host, defaultTenant);
    let cancelled = false;

    void resolveTenantConfig(retailerCode)
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
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}
