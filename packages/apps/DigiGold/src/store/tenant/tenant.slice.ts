import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { applyBuildSwitches } from '@/features/tenant/buildSwitches';
import type { TenantConfig } from '@/features/tenant/tenant.types';
import type { RootState } from '@/store';

type TenantState = {
  config: TenantConfig | null;
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
    },
  },
});

export const { tenantConfigReceived } = tenantSlice.actions;
export const tenantReducer = tenantSlice.reducer;

// What the app should act on: the tenant's config with the build-level switches applied
// (e.g. jewellery hidden in production). Memoized so components don't re-render on every read.
export const selectTenantConfig = createSelector(
  [(state: RootState) => state.tenant.config],
  (config): TenantConfig | null => (config ? applyBuildSwitches(config) : null),
);
