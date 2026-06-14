import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "../features/cart/cartSlice";
import cartStabilityReducer from "../features/cart/cartStabilitySlice";
import authReducer from "../features/auth/authSlice";
import orderReducer from "../features/order/orderSlice";
import recommendationReducer from "../features/recommendations/recommendationSlice";
import favCategoryReducer from "../features/favCategory/favCategorySlice";

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    cartStability: cartStabilityReducer,
    auth: authReducer,
    order: orderReducer,
    recommendations: recommendationReducer,
    favCategory: favCategoryReducer,
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
