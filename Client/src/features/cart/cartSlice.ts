import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { type RootState } from "../../app/store";

export interface CartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Cart {
  _id: string;
  user_id: string;
  items: CartItem[];
  subtotal: number;
}

interface CartState {
  cart: Cart | null;
  count: number;
  loading: boolean;
  error: string | null;
}

const initialState: CartState = {
  cart: null,
  count: 0,
  loading: false,
  error: null,
};

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8080/api";
};

// Async Thunks
export const fetchCart = createAsyncThunk(
  "cart/fetchCart",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/cart`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        return thunkAPI.rejectWithValue(errData.error || "Failed to fetch cart");
      }
      const json = await res.json();
      return json.data as Cart;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const addItemToCart = createAsyncThunk(
  "cart/addItem",
  async (payload: { product_id: string; quantity: number }, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        return thunkAPI.rejectWithValue(errData.error || "Failed to add item to cart");
      }
      const json = await res.json();
      return json.data as Cart;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const updateItemQty = createAsyncThunk(
  "cart/updateQty",
  async (payload: { product_id: string; quantity: number }, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/cart/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        return thunkAPI.rejectWithValue(errData.error || "Failed to update item quantity");
      }
      const json = await res.json();
      return json.data as Cart;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const removeItem = createAsyncThunk(
  "cart/removeItem",
  async (productId: string, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/cart/remove/${productId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        return thunkAPI.rejectWithValue(errData.error || "Failed to remove item");
      }
      const json = await res.json();
      return json.data as Cart;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const clearCartItems = createAsyncThunk(
  "cart/clearItems",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/cart/clear`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        return thunkAPI.rejectWithValue(errData.error || "Failed to clear cart");
      }
      return true;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    resetCart: (state) => {
      state.cart = null;
      state.count = 0;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchCart
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action: PayloadAction<Cart>) => {
        state.loading = false;
        const items = action.payload.items || [];
        state.cart = { ...action.payload, items };
        state.count = items.reduce((acc, item) => acc + item.quantity, 0);
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // addItemToCart
      .addCase(addItemToCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addItemToCart.fulfilled, (state, action: PayloadAction<Cart>) => {
        state.loading = false;
        const items = action.payload.items || [];
        state.cart = { ...action.payload, items };
        state.count = items.reduce((acc, item) => acc + item.quantity, 0);
      })
      .addCase(addItemToCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updateItemQty
      .addCase(updateItemQty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateItemQty.fulfilled, (state, action: PayloadAction<Cart>) => {
        state.loading = false;
        const items = action.payload.items || [];
        state.cart = { ...action.payload, items };
        state.count = items.reduce((acc, item) => acc + item.quantity, 0);
      })
      .addCase(updateItemQty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // removeItem
      .addCase(removeItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeItem.fulfilled, (state, action: PayloadAction<Cart>) => {
        state.loading = false;
        const items = action.payload.items || [];
        state.cart = { ...action.payload, items };
        state.count = items.reduce((acc, item) => acc + item.quantity, 0);
      })
      .addCase(removeItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // clearCartItems
      .addCase(clearCartItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearCartItems.fulfilled, (state) => {
        state.loading = false;
        state.cart = {
          _id: state.cart?._id || "",
          user_id: state.cart?.user_id || "",
          items: [],
          subtotal: 0,
        };
        state.count = 0;
      })
      .addCase(clearCartItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetCart } = cartSlice.actions;
export default cartSlice.reducer;
