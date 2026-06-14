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

interface PendingAction {
  type: "add" | "update" | "remove" | "clear";
  product_id?: string;
  quantity?: number;
}

interface CartState {
  cart: Cart | null;
  count: number;
  loading: boolean;
  error: string | null;
  pendingActions: PendingAction[];
  syncing: boolean;
}

const initialState: CartState = {
  cart: null,
  count: 0,
  loading: false,
  error: null,
  pendingActions: [],
  syncing: false,
};

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8080/api";
};

// Helper to recalculate cart totals
function recalcCart(cart: Cart): Cart {
  const subtotal = cart.items.reduce((acc, item) => acc + item.subtotal, 0);
  return { ...cart, subtotal, items: [...cart.items] };
}

// Async Thunks
export const fetchCart = createAsyncThunk(
  "cart/fetchCart",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    // Don't fetch if offline — preserve current state
    if (!navigator.onLine) {
      return thunkAPI.rejectWithValue("offline");
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/cart`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
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
  async (payload: { product_id: string; quantity: number; unit_price?: number }, thunkAPI) => {
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
        body: JSON.stringify({ product_id: payload.product_id, quantity: payload.quantity }),
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
        headers: { "Authorization": `Bearer ${token}` },
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
        headers: { "Authorization": `Bearer ${token}` },
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

// Replay pending actions on reconnect
export const syncPendingActions = createAsyncThunk(
  "cart/syncPending",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const pending = state.cart.pendingActions;
    if (pending.length === 0) return;

    // Just refetch the cart — server is source of truth
    // Pending actions were optimistic, server state wins on reconnect
    await thunkAPI.dispatch(fetchCart());
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
      state.pendingActions = [];
    },
    // Optimistic local update for qty change (instant UI, no server wait)
    optimisticUpdateQty: (state, action: PayloadAction<{ product_id: string; quantity: number }>) => {
      if (!state.cart) return;
      const { product_id, quantity } = action.payload;
      const items = state.cart.items.map((item) => {
        if (item.product_id === product_id) {
          return { ...item, quantity, subtotal: quantity * item.unit_price };
        }
        return item;
      });
      state.cart = recalcCart({ ...state.cart, items });
      state.count = items.reduce((acc, item) => acc + item.quantity, 0);
    },
    // Optimistic add
    optimisticAddItem: (state, action: PayloadAction<{ product_id: string; quantity: number; unit_price: number }>) => {
      if (!state.cart) return;
      const { product_id, quantity, unit_price } = action.payload;
      const existing = state.cart.items.find((i) => i.product_id === product_id);
      let items: CartItem[];
      if (existing) {
        items = state.cart.items.map((item) =>
          item.product_id === product_id
            ? { ...item, quantity: item.quantity + quantity, subtotal: (item.quantity + quantity) * item.unit_price }
            : item
        );
      } else {
        items = [...state.cart.items, { product_id, quantity, unit_price, subtotal: quantity * unit_price }];
      }
      state.cart = recalcCart({ ...state.cart, items });
      state.count = items.reduce((acc, item) => acc + item.quantity, 0);
    },
    // Optimistic remove
    optimisticRemoveItem: (state, action: PayloadAction<string>) => {
      if (!state.cart) return;
      const items = state.cart.items.filter((item) => item.product_id !== action.payload);
      state.cart = recalcCart({ ...state.cart, items });
      state.count = items.reduce((acc, item) => acc + item.quantity, 0);
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchCart — only update on success, never wipe on failure
      .addCase(fetchCart.pending, (state) => {
        // Only show loading if cart is empty (first load)
        if (!state.cart) state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action: PayloadAction<Cart>) => {
        state.loading = false;
        const items = action.payload.items || [];
        state.cart = { ...action.payload, items };
        state.count = items.reduce((acc, item) => acc + item.quantity, 0);
        state.pendingActions = []; // Clear pending since server is in sync
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        // DON'T clear cart on failure — preserve last known state
        if (action.payload !== "offline") {
          state.error = action.payload as string;
        }
      })
      // addItemToCart — no loading state (optimistic update handles UI)
      .addCase(addItemToCart.pending, () => {
        // No loading — optimistic update already done
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
        // On failure, queue for retry — don't revert optimistic (user sees it)
      })
      // updateItemQty — no loading (optimistic)
      .addCase(updateItemQty.pending, () => {})
      .addCase(updateItemQty.fulfilled, (state, action: PayloadAction<Cart>) => {
        const items = action.payload.items || [];
        state.cart = { ...action.payload, items };
        state.count = items.reduce((acc, item) => acc + item.quantity, 0);
      })
      .addCase(updateItemQty.rejected, (state, action) => {
        state.error = action.payload as string;
        // Keep optimistic state — will reconcile on next sync
      })
      // removeItem — no loading (optimistic)
      .addCase(removeItem.pending, () => {})
      .addCase(removeItem.fulfilled, (state, action: PayloadAction<Cart>) => {
        const items = action.payload.items || [];
        state.cart = { ...action.payload, items };
        state.count = items.reduce((acc, item) => acc + item.quantity, 0);
      })
      .addCase(removeItem.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // clearCartItems
      .addCase(clearCartItems.pending, (state) => {
        state.loading = true;
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

export const { resetCart, optimisticUpdateQty, optimisticAddItem, optimisticRemoveItem } = cartSlice.actions;
export default cartSlice.reducer;
