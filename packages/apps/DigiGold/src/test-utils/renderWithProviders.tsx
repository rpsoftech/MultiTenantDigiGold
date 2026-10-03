import type { ReactElement, ReactNode } from 'react';
import { render, renderHook, type RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeStore, type AppStore, type RootState } from '@/store';
import { ToastProvider } from '@/components/common/Toast/Toast';
import type { SessionUser } from '@/store/session/session.types';

export const customerUser: SessionUser = {
  userId: 'user-1',
  role: 'customer',
  mobileNumber: '9999900001',
  isNewUser: false,
  kycStatus: 'not_started',
};

type ProviderOptions = {
  user?: SessionUser | null;
  // Extra store slices to start with, e.g. a market rate that is already known.
  preloaded?: Partial<RootState>;
};

export type TestContext = {
  store: AppStore;
  queryClient: QueryClient;
};

function createContext({ user = customerUser, preloaded }: ProviderOptions = {}): TestContext {
  const store = makeStore({
    session: {
      user,
      isAuthenticated: Boolean(user),
      registrationToken: null,
      registrationPhone: null,
    },
    ...preloaded,
  });
  // Retries and cache time would make failing-request tests slow and leak between tests.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return { store, queryClient };
}

function createWrapper({ store, queryClient }: TestContext) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </Provider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions = {},
): RenderResult & TestContext {
  const context = createContext(options);
  const result = render(ui, { wrapper: createWrapper(context) });
  return { ...result, ...context };
}

export function renderHookWithProviders<Result, Props = undefined>(
  hook: (props: Props) => Result,
  options: ProviderOptions & { initialProps?: Props } = {},
) {
  const { initialProps, ...providerOptions } = options;
  const context = createContext(providerOptions);
  const result = renderHook(hook, { wrapper: createWrapper(context), initialProps });
  return { ...result, ...context };
}

// jsdom has no matchMedia, which the Modal's responsive sheet/dialog switch relies on.
export function installMatchMedia(matches = true): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

// Builds an unsigned JWT-shaped string; the client only ever decodes the payload.
export function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}
