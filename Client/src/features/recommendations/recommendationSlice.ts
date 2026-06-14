import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { type RootState } from "../../app/store";

export interface RecommendationProduct {
  _id: string;
  Brand: string;
  Product: string;
  Quantity: string;
  Price: number;
  MRP: number;
  image_small: string;
  stock: number;
}

export interface Recommendation {
  product_id: string;
  product: RecommendationProduct;
  score: number;
  urgency: "low" | "medium" | "high";
  last_purchased_days_ago: number;
  avg_interval_days: number;
  purchase_count: number;
}

interface RecommendationState {
  items: Recommendation[];
  loading: boolean;
  error: string | null;
}

const initialState: RecommendationState = {
  items: [],
  loading: false,
  error: null,
};

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8080/api";
};

export const fetchRecommendations = createAsyncThunk(
  "recommendations/fetch",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    if (!token) return thunkAPI.rejectWithValue("Not authenticated");

    try {
      const res = await fetch(`${getApiBaseUrl()}/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return thunkAPI.rejectWithValue("Failed to fetch recommendations");
      }
      const json = await res.json();
      return (json.data || []) as Recommendation[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message || "Network error");
    }
  }
);

export const recommendationSlice = createSlice({
  name: "recommendations",
  initialState,
  reducers: {
    resetRecommendations: (state) => {
      state.items = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action: PayloadAction<Recommendation[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetRecommendations } = recommendationSlice.actions;
export default recommendationSlice.reducer;
