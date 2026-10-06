import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import type { Product } from '@/features/marketplace/marketplace.types';
import { makeStore } from '@/store';

export function renderable(ui: ReactNode, { ecommerce = true } = {}) {
  const store = makeStore({
    tenant: {
      config: {
        ...DEFAULT_TENANT_CONFIG,
        activeModules: { ...DEFAULT_TENANT_CONFIG.activeModules, ecommerce },
      },
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </Provider>
  );
}

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'bangles-design-1',
    code: 'BNR00083',
    title: 'Green Glow Bangle',
    imageUrl: '/bangle.jpg',
    imageAlt: 'Green Glow Bangle',
    price: 357865.4,
    currency: 'INR',
    weight: 23,
    carat: '22KT Gold',
    color: 'Yellow',
    category: 'Bangles',
    designType: 'Dailywear Collection',
    gender: 'Ladies',
    collection: 'Festive',
    gifts: 'For Her',
    isNew: false,
    ...overrides,
  };
}
