import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "./app/store";
import { fetchCart, addItemToCart, resetCart, updateItemQty, removeItem, optimisticUpdateQty, optimisticAddItem, optimisticRemoveItem } from "./features/cart/cartSlice";
import { fetchFavCategories, clearFavCategories } from "./features/favCategory/favCategorySlice";
import { fetchCartStatus } from "./features/cart/cartStabilitySlice";
import { fetchRecommendations } from "./features/recommendations/recommendationSlice";
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { Footer } from "./components/Footer";
import { AuthPage } from "./components/AuthPage";
import { ProductPage, type Product } from "./components/ProductPage";
import { CartPage } from "./components/CartPage";
import { CheckoutPage } from "./components/CheckoutPage";
import { OrderConfirmation } from "./components/OrderConfirmation";
import { OrdersPage } from "./components/OrdersPage";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { SearchPage } from "./components/SearchPage";
import { TaskShoppingPage } from "./components/TaskShoppingPage";
import { Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Routes, Route, useNavigate, useParams, useLocation, Navigate } from "react-router-dom";

interface PaginationMeta {
  current_page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

interface ProductDetailWrapperProps {
  apiBaseUrl: string;
  onAddToCart: (product_id: string, qty: number) => Promise<void>;
}

const ProductDetailWrapper = ({ apiBaseUrl, onAddToCart }: ProductDetailWrapperProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartItems = useSelector((state: RootState) => state.cart.cart?.items || []);
  const cartItem = cartItems.find((item) => item.product_id === id);
  const initialQty = cartItem ? cartItem.quantity : 1;

  const fetchProductDetail = async (isRefresh = false) => {
    if (!id) return;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/products/${id}`);
      if (!res.ok) throw new Error("Product not found");
      const json = await res.json();
      if (json.success && json.data) {
        setProduct(json.data);
      } else {
        throw new Error("Failed to load product details");
      }
    } catch (err: any) {
      console.error("Error loading product detail:", err);
      setError(err.message || "Something went wrong");
    } finally {
      if (!isRefresh) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductDetail();
  }, [id, apiBaseUrl]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#49a353]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-red-500">{error || "Product not found"}</p>
        <button
          onClick={() => navigate("/")}
          className="bg-[#ffd814] text-[#0f1111] px-6 py-2 rounded-lg font-bold hover:bg-[#f7ca00]"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <ProductPage
      product={product}
      onBack={() => navigate("/")}
      onAddToCart={(qty) => onAddToCart(product._id, qty)}
      onRefresh={() => fetchProductDetail(true)}
      initialQty={initialQty}
    />
  );
};

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const cartCount = useSelector((state: RootState) => state.cart.count);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const cartItems = useSelector((state: RootState) => state.cart.cart?.items || []);

  // Fetch cart on login or mount
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCart());
      dispatch(fetchFavCategories());
    } else {
      dispatch(resetCart());
      dispatch(clearFavCategories());
    }
  }, [isAuthenticated, dispatch]);

  // Poll cart stability status every 30 seconds (skip when offline)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (navigator.onLine) dispatch(fetchCartStatus());
    const interval = setInterval(() => {
      if (navigator.onLine) dispatch(fetchCartStatus());
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, dispatch]);

  // Fetch recommendations for product ordering
  const recommendationItems = useSelector((state: RootState) => state.recommendations?.items || []);
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchRecommendations());
    }
  }, [isAuthenticated, dispatch]);

  // Catalog data states
  const [products, setProducts] = useState<Product[]>([]);
  const [favProducts, setFavProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [favProductsPage, setFavProductsPage] = useState(1);
  const [favProductsPagination, setFavProductsPagination] = useState<PaginationMeta | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingFavProducts, setLoadingFavProducts] = useState(false);
  const [stockErrorPopup, setStockErrorPopup] = useState<string | null>(null);
  const [localOutOfStock, setLocalOutOfStock] = useState<Set<string>>(new Set());
  const favCategories = useSelector((state: RootState) => state.favCategory.categories);

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  // Fetch favorite products
  useEffect(() => {
    if (!isAuthenticated || favCategories.length === 0) {
      setFavProducts([]);
      return;
    }

    const fetchFavProducts = async () => {
      setLoadingFavProducts(true);
      try {
        const res = await fetch(`${apiBaseUrl}/products/categories?page=${favProductsPage}&limit=10`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ categories: favCategories }),
        });
        if (!res.ok) throw new Error("Failed to fetch favorite products");
        const json = await res.json();
        if (json.success) {
          setFavProducts(json.data || []);
          setFavProductsPagination(json.pagination || null);
        }
      } catch (err) {
        console.error("Error fetching favorite products:", err);
      } finally {
        setLoadingFavProducts(false);
      }
    };

    fetchFavProducts();
  }, [favCategories, isAuthenticated, apiBaseUrl, favProductsPage]);

  // Fetch paginated products list
  useEffect(() => {
    if (location.pathname !== "/") return;

    const fetchProducts = async () => {
      setLoadingCatalog(true);
      try {
        const res = await fetch(`${apiBaseUrl}/products?page=${currentPage}&limit=20`);
        if (!res.ok) throw new Error("Failed to fetch products");
        const json = await res.json();
        if (json.success) {
          setProducts(json.data || []);
          setPagination(json.pagination || null);
        }
      } catch (err) {
        // Don't clear products on failure — keep last known state
        console.error("Error fetching products:", err);
      } finally {
        setLoadingCatalog(false);
      }
    };

    // Only fetch if online
    if (navigator.onLine) {
      fetchProducts();
    } else {
      setLoadingCatalog(false);
    }
  }, [currentPage, location.pathname, apiBaseUrl]);

  // Feature 4: Re-sort products when recommendations load
  const sortedProducts = (() => {
    if (!isAuthenticated || !recommendationItems || recommendationItems.length === 0) return products;
    const scoreMap = new Map<string, number>();
    recommendationItems.forEach((rec) => scoreMap.set(rec.product_id, rec.score));
    return [...products].sort((a, b) => (scoreMap.get(b._id) || 0) - (scoreMap.get(a._id) || 0));
  })();



  return (
    <Routes>
      <Route path="/auth" element={<AuthPage onBackToMarketplace={() => navigate("/")} />} />
      
      <Route
        path="*"
        element={
          <div className="bg-white min-h-screen font-sans antialiased text-[#0f1111] flex flex-col">
            {/* Network status banner for offline/online sync */}
            <NetworkStatusBanner />

            {/* Header component connected to Redux */}
            <Header 
              cartCount={cartCount} 
              onSignInClick={() => navigate("/auth")}
              onRegisterClick={() => navigate("/auth")}
              onLogoClick={() => navigate("/")}
              onCartClick={() => navigate("/cart")}
              onReorderClick={() => navigate("/orders")}
              onSearch={(query) => {
                 if (!query.trim()) {
                   navigate("/");
                   return;
                 }
                 // Smart routing: detect task/intent vs simple search
                 const taskPatterns = /\b(make|cook|prepare|recipe|bake|fry|ingredients for|i want to|how to|need for|items for|shopping for)\b/i;
                 if (taskPatterns.test(query)) {
                   navigate(`/task-shopping?task=${encodeURIComponent(query)}`);
                 } else {
                   navigate(`/search?q=${encodeURIComponent(query)}`);
                 }
              }}
            />


            <Routes>
              {/* Marketplace Catalog List */}
              <Route
                path="/"
                element={
                  <>
                    {/* Main Hero Banner */}
                    <HeroSection />

                    {/* Products Slider Section */}
                    <main className="max-w-[1500px] mx-auto px-4 py-6 relative z-20 flex-1 w-full">
                      {loadingCatalog ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-3 w-full">
                          <Loader2 size={36} className="text-[#49a353] animate-spin" />
                          <span className="text-sm text-gray-500 font-medium">Fetching fresh products...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-6 w-full">
                          {/* Section Header */}
                          <div className="flex items-center justify-between">
                            <h2 className="text-xl md:text-2xl font-bold text-[#0f1111]">
                              Today's Deals & Trending Products
                            </h2>
                            <span className="text-sm text-[#007185] hover:text-[#c45500] cursor-pointer font-medium hidden sm:inline">
                              See more ›
                            </span>
                          </div>

                          {/* Horizontal Product Slider */}
                          {(() => {
                            const sliderRef = React.createRef<HTMLDivElement>();
                            const slideProducts = (dir: 'left' | 'right') => {
                              if (sliderRef.current) {
                                sliderRef.current.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' });
                              }
                            };
                            return (
                              <div className="relative group">
                                {/* Left Arrow */}
                                <button
                                  onClick={() => slideProducts('left')}
                                  className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 bg-white text-gray-600 hover:text-gray-900 w-10 h-16 rounded-r-md shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-l-0 border-gray-200"
                                >
                                  <ChevronLeft size={22} />
                                </button>

                                <div
                                  ref={sliderRef}
                                  className="overflow-x-auto scrollbar-hide flex gap-4 scroll-smooth pb-2"
                                >
                                  {sortedProducts.map((product) => {

                                    const hasDiscount = product.MRP > product.Price;
                                    const stock = (product as any).stock ?? 999;
                                    const isOutOfStock = stock === 0 || localOutOfStock.has(product._id);
                                    const isLowStock = stock > 0 && stock <= 5;
                                    const recItem = recommendationItems.find((r) => r.product_id === product._id);
                                    const cartItem = cartItems.find((item) => item.product_id === product._id);
                                    return (
                                      <div
                                        key={product._id}
                                        onClick={() => navigate(`/product/${product._id}`)}
                                        className={`shrink-0 w-[180px] bg-white rounded-lg flex flex-col justify-between transition duration-200 cursor-pointer border relative group/card ${
                                          isOutOfStock ? "border-red-200 opacity-70" : "border-gray-200 hover:shadow-md hover:border-gray-300"
                                        }`}
                                      >
                                        {/* Badges */}
                                        {hasDiscount && !isOutOfStock && (
                                          <span className="absolute top-2 left-2 z-10 bg-[#cc0c39] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            {Math.round(((product.MRP - product.Price) / product.MRP) * 100)}% Off
                                          </span>
                                        )}
                                        {isOutOfStock && (
                                          <span className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            Out of Stock
                                          </span>
                                        )}
                                        {isLowStock && !isOutOfStock && (
                                          <span className="absolute top-2 right-2 z-10 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            Only {stock} left
                                          </span>
                                        )}
                                        {recItem && !isOutOfStock && (
                                          <span className="absolute top-2 left-2 z-10 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            ⟳ Buy Again
                                          </span>
                                        )}

                                        {/* Image */}
                                        <div className="relative p-4 pb-2">
                                          <div className="h-[130px] w-full flex items-center justify-center">
                                            <img
                                              src={product.image_small}
                                              alt={product.Product}
                                              className={`max-h-full max-w-full object-contain select-none ${
                                                isOutOfStock ? "grayscale" : ""
                                              }`}
                                            />
                                          </div>

                                          {/* Green + Button (Amazon Now style) */}
                                          {!isOutOfStock && !cartItem && (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!isAuthenticated) {
                                                  navigate("/auth");
                                                } else {
                                                  dispatch(optimisticAddItem({ product_id: product._id, quantity: 1, unit_price: product.Price }));
                                                  try {
                                                    await dispatch(addItemToCart({ product_id: product._id, quantity: 1 })).unwrap();
                                                  } catch (error: any) {
                                                    const errMsg = typeof error === 'string' ? error.toLowerCase() : '';
                                                    if (errMsg.includes("out of stock") || errMsg.includes("available")) {
                                                      setStockErrorPopup(product._id);
                                                      setLocalOutOfStock(prev => new Set(prev).add(product._id));
                                                      dispatch(fetchCart());
                                                    } else {
                                                      alert(error || "Failed to add to cart");
                                                      dispatch(fetchCart());
                                                    }
                                                  }
                                                }
                                              }}
                                              className="absolute bottom-0 right-3 w-8 h-8 bg-[#49a353] hover:bg-[#3d8b46] text-white rounded-full flex items-center justify-center shadow-md transition active:scale-90 cursor-pointer z-10"
                                              title="Add to cart"
                                            >
                                              <Plus size={18} strokeWidth={3} />
                                            </button>
                                          )}

                                          {/* Quantity stepper when in cart */}
                                          {!isOutOfStock && cartItem && (
                                            <div className="absolute bottom-0 right-3 flex items-center h-8 bg-[#49a353] rounded-full shadow-md overflow-hidden z-10">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (cartItem.quantity === 1) {
                                                    dispatch(optimisticRemoveItem(product._id));
                                                    dispatch(removeItem(product._id));
                                                  } else {
                                                    dispatch(optimisticUpdateQty({ product_id: product._id, quantity: cartItem.quantity - 1 }));
                                                    dispatch(updateItemQty({ product_id: product._id, quantity: cartItem.quantity - 1 }));
                                                  }
                                                }}
                                                className="text-white px-2 h-full font-bold cursor-pointer transition text-sm flex items-center justify-center hover:bg-[#3d8b46] active:scale-90"
                                              >
                                                −
                                              </button>
                                              <span className="text-white text-xs font-bold px-2">
                                                {cartItem.quantity}
                                              </span>
                                              <button
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  const atMax = cartItem.quantity >= stock;
                                                  if (!atMax) {
                                                    dispatch(optimisticUpdateQty({ product_id: product._id, quantity: cartItem.quantity + 1 }));
                                                    try {
                                                      await dispatch(updateItemQty({ product_id: product._id, quantity: cartItem.quantity + 1 })).unwrap();
                                                    } catch (error: any) {
                                                      const errMsg = typeof error === 'string' ? error.toLowerCase() : '';
                                                      if (errMsg.includes("out of stock") || errMsg.includes("available")) {
                                                        setStockErrorPopup(product._id);
                                                        setLocalOutOfStock(prev => new Set(prev).add(product._id));
                                                        dispatch(fetchCart());
                                                      } else {
                                                        alert(error || "Failed to update cart");
                                                        dispatch(fetchCart());
                                                      }
                                                    }
                                                  }
                                                }}
                                                className="text-white px-2 h-full font-bold cursor-pointer transition text-sm flex items-center justify-center hover:bg-[#3d8b46] active:scale-90"
                                              >
                                                +
                                              </button>
                                            </div>
                                          )}

                                          {/* See Similar for out of stock */}
                                          {isOutOfStock && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/product/${product._id}`, { state: { scrollToSimilar: true } });
                                              }}
                                              className="absolute bottom-0 right-3 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm cursor-pointer transition z-10"
                                            >
                                              Similar
                                            </button>
                                          )}
                                        </div>

                                        {/* Product Info */}
                                        <div className="p-3 pt-2 flex flex-col gap-1">
                                          <h3 className="text-xs text-[#0f1111] font-medium leading-snug line-clamp-2 min-h-[32px]">
                                            {product.Product}
                                          </h3>
                                          <span className="text-[10px] text-gray-400 truncate">
                                            {product.Quantity}
                                          </span>
                                          <div className="flex items-baseline gap-1.5 mt-1">
                                            <span className="text-sm font-bold text-[#0f1111]">₹{product.Price}</span>
                                            {hasDiscount && (
                                              <span className="text-[10px] text-gray-400 line-through">₹{product.MRP}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Right Arrow */}
                                <button
                                  onClick={() => slideProducts('right')}
                                  className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 bg-white text-gray-600 hover:text-gray-900 w-10 h-16 rounded-l-md shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-r-0 border-gray-200"
                                >
                                  <ChevronRight size={22} />
                                </button>
                              </div>
                            );
                          })()}

                          {/* Pagination Controls */}
                          {pagination && pagination.total_pages > 1 && (
                            <div className="flex items-center justify-center gap-3 py-3.5 px-6 rounded-lg max-w-max mx-auto text-sm select-none border border-gray-200">
                              <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => p - 1)}
                                className="px-4 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition font-semibold text-xs"
                              >
                                Previous
                              </button>
                              <span className="font-bold text-gray-600">
                                Page {currentPage} of {pagination.total_pages}
                              </span>
                              <button
                                disabled={currentPage === pagination.total_pages}
                                onClick={() => setCurrentPage((p) => p + 1)}
                                className="px-4 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition font-semibold text-xs"
                              >
                                Next
                              </button>
                            </div>
                          )}
                          {/* Favorite Products Slider */}
                          {isAuthenticated && favProducts.length > 0 && !loadingFavProducts && (
                            <div className="mt-8 border-t border-gray-100 pt-8">
                              <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl md:text-2xl font-bold text-[#0f1111] flex items-center gap-2">
                                  From Your Favorite Categories
                                </h2>
                                <span className="text-sm text-[#007185] hover:text-[#c45500] cursor-pointer font-medium hidden sm:inline">
                                  See more ›
                                </span>
                              </div>

                              {/* Product Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6 pb-2">
                                {favProducts.map((product) => {

                                  const hasDiscount = product.MRP > product.Price;
                                  const stock = (product as any).stock ?? 999;
                                  const isOutOfStock = stock === 0 || localOutOfStock.has(product._id);
                                  const isLowStock = stock > 0 && stock <= 5;
                                  const cartItem = cartItems.find((item) => item.product_id === product._id);
                                  return (
                                    <div
                                      key={product._id}
                                      onClick={() => navigate(`/product/${product._id}`)}
                                      className={`w-full bg-white rounded-lg flex flex-col justify-between transition duration-200 cursor-pointer border relative group/card ${
                                        isOutOfStock ? "border-red-200 opacity-70" : "border-gray-200 hover:shadow-md hover:border-gray-300"
                                      }`}
                                    >
                                            {/* Badges */}
                                            {hasDiscount && !isOutOfStock && (
                                              <span className="absolute top-2 left-2 z-10 bg-[#cc0c39] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                {Math.round((1 - product.Price / product.MRP) * 100)}% off
                                              </span>
                                            )}
                                            {isLowStock && !isOutOfStock && (
                                              <span className="absolute top-2 left-2 z-10 bg-[#b12704] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                                Only {stock} left
                                              </span>
                                            )}
                                            {isOutOfStock && (
                                              <span className="absolute top-2 left-2 z-10 bg-gray-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                                Out of Stock
                                              </span>
                                            )}

                                            {/* Image */}
                                            <div className={`h-[150px] w-full p-3 bg-[#f7f7f7] rounded-t-lg flex items-center justify-center relative overflow-hidden ${isOutOfStock ? "grayscale" : ""}`}>
                                              <img
                                                src={product.image_small || `https://picsum.photos/seed/${product._id}/300/300`}
                                                alt={product.Product}
                                                className="max-h-full max-w-full object-contain mix-blend-multiply group-hover/card:scale-105 transition-transform duration-300"
                                              />
                                            </div>

                                            {/* Add/Quantity Button */}
                                            {!isOutOfStock && !cartItem && (
                                              <button
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  dispatch(optimisticAddItem({ ...product, quantity: 1, product_id: product._id, unit_price: product.Price }));
                                                  try {
                                                    await dispatch(addItemToCart({ product_id: product._id, quantity: 1 })).unwrap();
                                                  } catch (error: any) {
                                                    const errMsg = typeof error === 'string' ? error.toLowerCase() : '';
                                                    if (errMsg.includes("out of stock") || errMsg.includes("available")) {
                                                      setStockErrorPopup(product._id);
                                                      setLocalOutOfStock(prev => new Set(prev).add(product._id));
                                                      dispatch(fetchCart());
                                                    } else {
                                                      alert(error || "Failed to add to cart");
                                                      dispatch(fetchCart());
                                                    }
                                                  }
                                                }}
                                                className="absolute bottom-0 right-3 w-8 h-8 bg-[#49a353] hover:bg-[#3d8b46] text-white rounded-full flex items-center justify-center shadow-md transition active:scale-90 cursor-pointer z-10"
                                                title="Add to cart"
                                              >
                                                <Plus size={18} strokeWidth={3} />
                                              </button>
                                            )}

                                            {/* Quantity stepper when in cart */}
                                            {!isOutOfStock && cartItem && (
                                              <div className="absolute bottom-0 right-3 flex items-center h-8 bg-[#49a353] rounded-full shadow-md overflow-hidden z-10">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (cartItem.quantity === 1) {
                                                      dispatch(optimisticRemoveItem(product._id));
                                                      dispatch(removeItem(product._id));
                                                    } else {
                                                      dispatch(optimisticUpdateQty({ product_id: product._id, quantity: cartItem.quantity - 1 }));
                                                      dispatch(updateItemQty({ product_id: product._id, quantity: cartItem.quantity - 1 }));
                                                    }
                                                  }}
                                                  className="text-white px-2 h-full font-bold cursor-pointer transition text-sm flex items-center justify-center hover:bg-[#3d8b46] active:scale-90"
                                                >
                                                  −
                                                </button>
                                                <span className="text-white text-xs font-bold px-2">
                                                  {cartItem.quantity}
                                                </span>
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const atMax = cartItem.quantity >= stock;
                                                    if (!atMax) {
                                                      dispatch(optimisticUpdateQty({ product_id: product._id, quantity: cartItem.quantity + 1 }));
                                                      try {
                                                        await dispatch(updateItemQty({ product_id: product._id, quantity: cartItem.quantity + 1 })).unwrap();
                                                      } catch (error: any) {
                                                        const errMsg = typeof error === 'string' ? error.toLowerCase() : '';
                                                        if (errMsg.includes("out of stock") || errMsg.includes("available")) {
                                                          setStockErrorPopup(product._id);
                                                          setLocalOutOfStock(prev => new Set(prev).add(product._id));
                                                          dispatch(fetchCart());
                                                        } else {
                                                          alert(error || "Failed to update cart");
                                                          dispatch(fetchCart());
                                                        }
                                                      }
                                                    }
                                                  }}
                                                  className="text-white px-2 h-full font-bold cursor-pointer transition text-sm flex items-center justify-center hover:bg-[#3d8b46] active:scale-90"
                                                >
                                                  +
                                                </button>
                                              </div>
                                            )}

                                            {/* See Similar for out of stock */}
                                            {isOutOfStock && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  navigate(`/product/${product._id}`, { state: { scrollToSimilar: true } });
                                                }}
                                                className="absolute bottom-0 right-3 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm cursor-pointer transition z-10"
                                              >
                                                Similar
                                              </button>
                                            )}

                                            {/* Product Info */}
                                            <div className="p-3 pt-2 flex flex-col gap-1">
                                              <h3 className="text-xs text-[#0f1111] font-medium leading-snug line-clamp-2 min-h-[32px]">
                                                {product.Product}
                                              </h3>
                                              <span className="text-[10px] text-gray-400 truncate">
                                                {product.Quantity}
                                              </span>
                                              <div className="flex items-baseline gap-1.5 mt-1">
                                                <span className="text-sm font-bold text-[#0f1111]">₹{product.Price}</span>
                                                {hasDiscount && (
                                                  <span className="text-[10px] text-gray-400 line-through">₹{product.MRP}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                    })}
                                  </div>

                                  {/* Fav Products Pagination Controls */}
                                  {favProductsPagination && favProductsPagination.total_pages > 1 && (
                                    <div className="flex items-center justify-center gap-3 mt-6 mb-2 py-3.5 px-6 rounded-lg max-w-max mx-auto text-sm select-none border border-gray-200">
                                      <button
                                        disabled={favProductsPage === 1}
                                        onClick={() => setFavProductsPage((p) => p - 1)}
                                        className="px-4 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition font-semibold text-xs"
                                      >
                                        Previous
                                      </button>
                                      <span className="font-bold text-gray-600">
                                        Page {favProductsPage} of {favProductsPagination.total_pages}
                                      </span>
                                      <button
                                        disabled={favProductsPage === favProductsPagination.total_pages}
                                        onClick={() => setFavProductsPage((p) => p + 1)}
                                        className="px-4 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition font-semibold text-xs"
                                      >
                                        Next
                                      </button>
                                    </div>
                                  )}

                          </div>
                          )}
                        </div>
                      )}
                    </main>

                    {/* Out of Stock Popup for Homepage Grid */}
                    {stockErrorPopup && (
                      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl p-6 max-w-sm w-full flex flex-col items-center text-center gap-4 shadow-2xl">
                          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                            <span className="text-2xl font-bold">!</span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Out of Stock</h3>
                          <p className="text-sm text-gray-600">
                            We're sorry, but this product just went out of stock. 
                          </p>
                          <div className="flex flex-col gap-2 w-full mt-2">
                            <button
                              onClick={() => {
                                navigate(`/product/${stockErrorPopup}`, { state: { scrollToSimilar: true } });
                                setStockErrorPopup(null);
                              }}
                              className="w-full py-2.5 bg-[#49a353] hover:bg-[#3d8b46] text-white font-semibold rounded-full transition cursor-pointer"
                            >
                              See Similar Products
                            </button>
                            <button
                              onClick={() => setStockErrorPopup(null)}
                              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0f1111] font-semibold rounded-full transition cursor-pointer"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                }
              />

              {/* Search Results Route */}
              <Route
                path="/search"
                element={<SearchPage />}
              />

              {/* Task Shopping Route */}
              <Route
                path="/task-shopping"
                element={<TaskShoppingPage />}
              />

              {/* Product Page Detail Route */}
              <Route
                path="/product/:id"
                element={
                  <ProductDetailWrapper 
                    apiBaseUrl={apiBaseUrl}
                    onAddToCart={async (product_id, qty) => {
                      if (!isAuthenticated) {
                        navigate("/auth");
                      } else {
                        // Use updateItemQty to SET exact quantity (not increment)
                        await dispatch(updateItemQty({ product_id, quantity: qty })).unwrap();
                      }
                    }}
                  />
                }
              />

              {/* Shopping Cart Route */}
              <Route
                path="/cart"
                element={<CartPage />}
              />

              {/* Checkout Route */}
              <Route
                path="/checkout"
                element={<CheckoutPage />}
              />

              {/* Order Confirmation Route */}
              <Route
                path="/order-confirmation"
                element={<OrderConfirmation />}
              />

              {/* Order History Route */}
              <Route
                path="/orders"
                element={<OrdersPage />}
              />

              {/* Catch-all Redirect to Home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <div className="h-20"></div>

            {/* Footer component */}
            <Footer />
          </div>
        }
      />
    </Routes>
  );
}

export default App;
