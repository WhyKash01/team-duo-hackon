import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface CartState {
  count: number;
}

const initialState: CartState = {
  count: 2
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    incrementCart: (state) => {
      state.count += 1;
    },
    addToCartByQty: (state, action: PayloadAction<number>) => {
      state.count += action.payload;
    },
    resetCart: (state) => {
      state.count = 0;
    }
  }
});

export const { incrementCart, addToCartByQty, resetCart } = cartSlice.actions;
export default cartSlice.reducer;
