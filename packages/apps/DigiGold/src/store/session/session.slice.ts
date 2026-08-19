import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { SessionUser } from './session.types';

type SessionState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
};

const initialState: SessionState = {
  user: null,
  isAuthenticated: false,
};

// The raw JWT stays in an HttpOnly cookie set by MainServer — this slice only ever holds
// the decoded, non-sensitive fields the UI needs for routing/rendering decisions.
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionEstablished: (state, action: PayloadAction<SessionUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    profileCompleted: (state) => {
      if (state.user) state.user.isNewUser = false;
    },
    sessionCleared: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
});

export const { sessionEstablished, profileCompleted, sessionCleared } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

export const selectSessionUser = (state: RootState): SessionUser | null => state.session.user;
export const selectIsAuthenticated = (state: RootState): boolean => state.session.isAuthenticated;
