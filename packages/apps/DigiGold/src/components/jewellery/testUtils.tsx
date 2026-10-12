import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import type { Product } from '@/features/marketplace/marketplace.types';
import { makeStore } from '@/store';

// resolved: false renders before this host's tenant config has arrived.
export function renderable(
  ui: ReactNode,
  { ecommerce = true, resolved = true } = {},
) {
  const store = makeStore({
    tenant: {
      config: {
        ...DEFAULT_TENANT_CONFIG,
        activeModules: { ...DEFAULT_TENANT_CONFIG.activeModules, ecommerce },
      },
      resolved,
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

// A bangle from the catalogue, with every required field; override what a test cares about.
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
    categoryId: 'bangles',
    designType: 'Dailywear Collection',
    gender: 'Ladies',
    collection: 'Festive',
    gifts: 'For Her',
    isNew: false,
    ...overrides,
  };
}
