import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { SessionUser } from './session.types';

type SessionState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  registrationToken: string | null;
  registrationPhone: string | null;
};

const initialState: SessionState = {
  user: null,
  isAuthenticated: false,
  registrationToken: null,
  registrationPhone: null,
};

// Raw JWTs are persisted by the auth service; this slice only holds the non-sensitive
// fields the UI needs for routing/rendering decisions.
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionEstablished: (state, action: PayloadAction<SessionUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.registrationToken = null;
      state.registrationPhone = null;
    },
    registrationStarted: (
      state,
      action: PayloadAction<{ token: string; phone: string }>,
    ) => {
      state.registrationToken = action.payload.token;
      state.registrationPhone = action.payload.phone;
      state.user = {
        userId: '',
        role: 'customer',
        mobileNumber: action.payload.phone,
        isNewUser: true,
        kycStatus: 'not_started',
      };
    },
    profileCompleted: (state) => {
      if (state.user) state.user.isNewUser = false;
      state.isAuthenticated = true;
      state.registrationToken = null;
      state.registrationPhone = null;
    },
    sessionCleared: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.registrationToken = null;
      state.registrationPhone = null;
    },
  },
});

export const {
  sessionEstablished,
  registrationStarted,
  profileCompleted,
  sessionCleared,
} = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

export const selectSessionUser = (state: RootState): SessionUser | null =>
  state.session.user;
export const selectIsAuthenticated = (state: RootState): boolean =>
  state.session.isAuthenticated;
export const selectIsAdmin = (state: RootState): boolean =>
  state.session.user?.role === 'admin';
