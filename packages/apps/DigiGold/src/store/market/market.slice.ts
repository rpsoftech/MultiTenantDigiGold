import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { MarketConnectionStatus, MarketRate } from '@/features/market/market.types';

type MarketState = {
  current: MarketRate | null;
  previous: MarketRate | null;
  status: MarketConnectionStatus;
};

const initialState: MarketState = {
  current: null,
  previous: null,
  status: 'connecting',
};

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    rateReceived: (state, action: PayloadAction<MarketRate>) => {
      state.previous = state.current;
      state.current = action.payload;
    },
    statusChanged: (state, action: PayloadAction<MarketConnectionStatus>) => {
      state.status = action.payload;
    },
  },
});

export const { rateReceived, statusChanged } = marketSlice.actions;
export const marketReducer = marketSlice.reducer;

export const selectMarketRate = (state: RootState): MarketRate | null => state.market.current;
export const selectPreviousMarketRate = (state: RootState): MarketRate | null =>
  state.market.previous;
export const selectMarketStatus = (state: RootState): MarketConnectionStatus =>
  state.market.status;
