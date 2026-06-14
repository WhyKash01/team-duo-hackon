import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

interface FavCategoryState {
  categories: string[];
  loading: boolean;
  error: string | null;
}

const initialState: FavCategoryState = {
  categories: [],
  loading: false,
  error: null,
};

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export const fetchFavCategories = createAsyncThunk(
  "favCategory/fetchFavCategories",
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as any;
    const token = state.auth?.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const response = await fetch(`${apiBaseUrl}/user/fav-categories`, {
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch favorite categories");
      }
      const json = await response.json();
      return json.data as string[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

export const addFavCategory = createAsyncThunk(
  "favCategory/addFavCategory",
  async (category: string, thunkAPI) => {
    const state = thunkAPI.getState() as any;
    const token = state.auth?.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const response = await fetch(`${apiBaseUrl}/user/fav-categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ category }),
      });
      if (!response.ok) {
        throw new Error("Failed to add favorite category");
      }
      return category;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

export const removeFavCategory = createAsyncThunk(
  "favCategory/removeFavCategory",
  async (category: string, thunkAPI) => {
    const state = thunkAPI.getState() as any;
    const token = state.auth?.user?.token;
    if (!token) return thunkAPI.rejectWithValue("User is not authenticated");

    try {
      const response = await fetch(`${apiBaseUrl}/user/fav-categories/${encodeURIComponent(category)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });
      if (!response.ok) {
        throw new Error("Failed to remove favorite category");
      }
      return category;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

const favCategorySlice = createSlice({
  name: "favCategory",
  initialState,
  reducers: {
    clearFavCategories: (state) => {
      state.categories = [];
      state.error = null;
    },
    // Optimistic updates
    optimisticAddFavCategory: (state, action) => {
      if (!state.categories.includes(action.payload)) {
        state.categories.push(action.payload);
      }
    },
    optimisticRemoveFavCategory: (state, action) => {
      state.categories = state.categories.filter(c => c !== action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchFavCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFavCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload || [];
      })
      .addCase(fetchFavCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Add
      .addCase(addFavCategory.fulfilled, (state, action) => {
        if (!state.categories.includes(action.payload)) {
          state.categories.push(action.payload);
        }
      })
      // Remove
      .addCase(removeFavCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter(c => c !== action.payload);
      });
  },
});

export const { clearFavCategories, optimisticAddFavCategory, optimisticRemoveFavCategory } = favCategorySlice.actions;
export default favCategorySlice.reducer;
