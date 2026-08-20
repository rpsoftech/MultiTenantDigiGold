import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { tenantReducer } from './tenant/tenant.slice';
import { sessionReducer } from './session/session.slice';

// market reducer gets added here when the market feature is built — not invented ahead
// of need.
const rootReducer = combineReducers({
  tenant: tenantReducer,
  session: sessionReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

// A store factory, not a module singleton — each Providers mount creates its own store
// with request-specific preloaded state (e.g. the SSR-resolved tenant config). A shared
// singleton would leak one request's tenant/session data into another's SSR render.
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
