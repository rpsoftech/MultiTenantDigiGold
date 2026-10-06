import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
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

export const selectTenantConfig = (state: RootState): TenantConfig | null =>
  state.tenant.config;
export const selectTenantResolved = (state: RootState): boolean =>
  state.tenant.resolved ?? true;
