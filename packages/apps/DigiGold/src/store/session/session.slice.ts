import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { SessionUser } from './session.types';

// `user`/`isAuthenticated` are the CUSTOMER session; `admin` is the admin panel session.
// They are independent (separate tokens in tokenStorage.ts and admin-tokens.ts), so they
// live in separate fields: sharing one slot made an admin look like a signed-in customer
// on customer pages, and a customer 401 then bounced them to the admin login.
type SessionState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  admin: SessionUser | null;
  revision: number;
  registrationToken: string | null;
  registrationPhone: string | null;
};

const initialState: SessionState = {
  user: null,
  isAuthenticated: false,
  admin: null,
  revision: 0,
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
      state.revision += 1;
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
      state.revision += 1;
      if (state.user) state.user.isNewUser = false;
      state.isAuthenticated = true;
      state.registrationToken = null;
      state.registrationPhone = null;
    },
    adminSessionEstablished: (state, action: PayloadAction<SessionUser>) => {
      state.admin = action.payload;
    },
    adminSessionCleared: (state) => {
      state.admin = null;
    },
    sessionCleared: (state) => {
      state.revision += 1;
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
  adminSessionEstablished,
  adminSessionCleared,
} = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

export const selectSessionUser = (state: RootState): SessionUser | null =>
  state.session.user;
export const selectIsAuthenticated = (state: RootState): boolean =>
  state.session.isAuthenticated;
// Each sign-in gets a new private query cache, including customers whose ID is not
// included in the OTP response. Tokens never need to become query keys.
export const selectSessionRevision = (state: RootState): number =>
  state.session.revision;
export const selectAdminUser = (state: RootState): SessionUser | null =>
  state.session.admin;
export const selectIsAdmin = (state: RootState): boolean =>
  state.session.admin?.role === 'admin';
