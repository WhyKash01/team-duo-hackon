import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { type RootState } from "../../app/store";

export interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface DeliveryLocation {
  type: string;
  address_line: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
}

export interface Order {
  _id: string;
  order_id: string;
  user_id: string;
  status: string;
  items: OrderItem[];
  item_total: number;
  delivery_fee: number;
  grand_total: number;
  delivery_location: DeliveryLocation;
  created_at: string;
  update_at: string;
}

interface OrderState {
  orders: Order[];
  lastOrder: Order | null;
  loading: boolean;
  error: string | null;
}

const initialState: OrderState = {
  orders: [],
  lastOrder: null,
  loading: false,
  error: null,
};

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8080/api";
};

export const placeOrder = createAsyncThunk(
  "order/placeOrder",
  async (
    payload: {
      items: { product_id: string; quantity: number }[];
      delivery_location: DeliveryLocation;
    },
    thunkAPI
  ) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/order/place`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        return thunkAPI.rejectWithValue(
          errData.error || "Failed to place order"
        );
      }
      const json = await res.json();
      return json.data as Order;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const fetchUserOrders = createAsyncThunk(
  "order/fetchUserOrders",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/orders`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        return thunkAPI.rejectWithValue(
          errData.error || "Failed to fetch orders"
        );
      }
      const json = await res.json();
      return (json.data || []) as Order[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const orderSlice = createSlice({
  name: "order",
  initialState,
  reducers: {
    resetOrders: (state) => {
      state.orders = [];
      state.lastOrder = null;
      state.loading = false;
      state.error = null;
    },
    clearLastOrder: (state) => {
      state.lastOrder = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // placeOrder
      .addCase(placeOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(placeOrder.fulfilled, (state, action: PayloadAction<Order>) => {
        state.loading = false;
        state.lastOrder = action.payload;
        state.orders = [action.payload, ...state.orders];
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchUserOrders
      .addCase(fetchUserOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchUserOrders.fulfilled,
        (state, action: PayloadAction<Order[]>) => {
          state.loading = false;
          state.orders = action.payload;
        }
      )
      .addCase(fetchUserOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetOrders, clearLastOrder } = orderSlice.actions;
export default orderSlice.reducer;
