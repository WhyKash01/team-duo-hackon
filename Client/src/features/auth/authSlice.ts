import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface Address {
  address_id?: string;
  type: string;
  address_line: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
}

export interface UserResponse {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  token: string;
  refresh_token: string;
  addresses?: Address[];
}

interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Read initial auth state from localStorage if available
const savedUser = localStorage.getItem("amazon_user");
const initialState: AuthState = {
  user: savedUser ? JSON.parse(savedUser) : null,
  isAuthenticated: !!savedUser,
  loading: false,
  error: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    authSuccess: (state, action: PayloadAction<UserResponse>) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload;
      state.error = null;
      localStorage.setItem("amazon_user", JSON.stringify(action.payload));
    },
    authFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      localStorage.removeItem("amazon_user");
    },
  },
});

export const { authStart, authSuccess, authFailure, clearError, logout } = authSlice.actions;
export default authSlice.reducer;
