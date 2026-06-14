import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { type RootState } from "../../app/store";

export interface StaleItem {
  product_id: string;
  type: "price_changed" | "low_stock" | "out_of_stock";
  old_price?: number;
  new_price?: number;
  available?: number;
}

interface CartStabilityState {
  staleItems: StaleItem[];
  loading: boolean;
}

const initialState: CartStabilityState = {
  staleItems: [],
  loading: false,
};

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8080/api";
};

export const fetchCartStatus = createAsyncThunk(
  "cartStability/fetchStatus",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return [];

    try {
      const res = await fetch(`${getApiBaseUrl()}/cart/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.stale_items || []) as StaleItem[];
    } catch {
      return [];
    }
  }
);

export const clearStaleItem = createAsyncThunk(
  "cartStability/clearItem",
  async (productId: string, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return productId;

    try {
      await fetch(`${getApiBaseUrl()}/cart/clear-stale`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: productId }),
      });
    } catch {
      // ignore
    }
    return productId;
  }
);

export const cartStabilitySlice = createSlice({
  name: "cartStability",
  initialState,
  reducers: {
    resetStaleItems: (state) => {
      state.staleItems = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCartStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCartStatus.fulfilled, (state, action: PayloadAction<StaleItem[]>) => {
        state.loading = false;
        state.staleItems = action.payload;
      })
      .addCase(fetchCartStatus.rejected, (state) => {
        state.loading = false;
      })
      .addCase(clearStaleItem.fulfilled, (state, action: PayloadAction<string>) => {
        state.staleItems = state.staleItems.filter(
          (item) => item.product_id !== action.payload
        );
      });
  },
});

export const { resetStaleItems } = cartStabilitySlice.actions;
export default cartStabilitySlice.reducer;
