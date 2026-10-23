import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { applyBuildSwitches } from '@/features/tenant/buildSwitches';
import type { LayoutStatus } from '@/features/layout/layout.types';
import type { TenantConfig } from '@/features/tenant/tenant.types';
import type { RootState } from '@/store';

type TenantState = {
  config: TenantConfig | null;
  // false while the browser is still resolving this host's tenant; config then holds the
  // build-time default. Unset counts as resolved.
  resolved?: boolean;
};

const initialState: TenantState = {
  config: null,
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    tenantConfigReceived: (state, action: PayloadAction<TenantConfig>) => {
      state.config = action.payload;
      state.resolved = true;
    },
    // The tenant API failed: keep the default config and stop waiting for it.
    tenantConfigUnavailable: (state) => {
      state.resolved = true;
    },
  },
});

export const { tenantConfigReceived, tenantConfigUnavailable } =
  tenantSlice.actions;
export const tenantReducer = tenantSlice.reducer;

// False until this host's tenant config has arrived (or failed to). Until then
// selectTenantConfig returns the build-time default, so module switches aren't final.
export const selectTenantResolved = (state: RootState): boolean =>
  state.tenant.resolved ?? true;

// What the app should act on: the tenant's config with the build-level switches applied
// (e.g. jewellery hidden in production). Memoized so components don't re-render on every read.
export const selectTenantConfig = createSelector(
  [(state: RootState) => state.tenant.config],
  (config): TenantConfig | null => (config ? applyBuildSwitches(config) : null),
  // With no build switch to apply the stored config comes back unchanged, by design;
  // Reselect's dev-mode check would otherwise warn that the selector is an identity.
  { devModeChecks: { identityFunctionCheck: 'never' } },
);

// Whether the tenant's published layout is known. A failed refresh never downgrades a
// layout that was already read: the last good one keeps rendering.
export const selectLayoutStatus = (state: RootState): LayoutStatus => {
  if (state.tenant.config?.layout) return 'ready';
  return state.tenant.resolved === false ? 'loading' : 'unavailable';
};
