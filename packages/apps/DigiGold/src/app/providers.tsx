'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeStore } from '@/store';
import { applyTenantTheme } from '@/features/tenant/applyTenantTheme';
import { ToastProvider } from '@/components/common/Toast/Toast';
import type { TenantConfig } from '@/features/tenant/tenant.types';

type ProvidersProps = {
  children: React.ReactNode;
  initialTenantConfig: TenantConfig;
};

function TenantThemeSync({ config }: { config: TenantConfig }) {
  useEffect(() => {
    // Re-applies the same values the SSR-inlined <style> tag already set — a no-op
    // visually, but keeps the pipeline reactive if tenantSlice.config is ever updated at
    // runtime (e.g. a future admin theme-preview feature) without a page reload.
    applyTenantTheme(config);
  }, [config]);

  return null;
}

export function Providers({ children, initialTenantConfig }: ProvidersProps) {
  // A fresh store per mount, preloaded with the SSR-resolved tenant config — avoids both
  // a cross-request singleton (unsafe once tenant config differs per request) and a
  // post-hydration dispatch delay (which would flash unbranded content for one frame).
  const [store] = useState(() =>
    makeStore({ tenant: { config: initialTenantConfig } })
  );
  const [queryClient] = useState(() => new QueryClient());

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TenantThemeSync config={initialTenantConfig} />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}
