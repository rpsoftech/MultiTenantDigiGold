import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
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

export const selectTenantConfig = (state: RootState): TenantConfig | null => state.tenant.config;
