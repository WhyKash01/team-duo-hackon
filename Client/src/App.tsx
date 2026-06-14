import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "./app/store";
import { fetchCart, addItemToCart, resetCart, updateItemQty, removeItem, optimisticUpdateQty, optimisticAddItem, optimisticRemoveItem } from "./features/cart/cartSlice";
import { fetchCartStatus } from "./features/cart/cartStabilitySlice";
import { fetchRecommendations } from "./features/recommendations/recommendationSlice";
import { Header } from "./components/Header";
import { SubHeader } from "./components/SubHeader";
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
import { Star, Loader2 } from "lucide-react";
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
      <div className="bg-white p-24 rounded shadow-sm flex flex-col items-center justify-center gap-3 w-full max-w-[1500px] mx-auto mt-6 border border-gray-200">
        <Loader2 size={36} className="text-[#e77600] animate-spin" />
        <span className="text-sm text-gray-500 font-medium">Retrieving product details...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white p-24 rounded shadow-sm flex flex-col items-center justify-center gap-4 w-full max-w-[1500px] mx-auto mt-6 border border-gray-200">
        <span className="text-red-600 font-semibold text-lg">{error || "Product not found"}</span>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer"
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
    } else {
      dispatch(resetCart());
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [stockErrorPopup, setStockErrorPopup] = useState<string | null>(null);
  const [localOutOfStock, setLocalOutOfStock] = useState<Set<string>>(new Set());

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

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

  // Helper to generate stars and count dynamically for catalog looks
  const getRandomRating = (productId: string) => {
    const code = productId.charCodeAt(productId.length - 1) || 5;
    const rating = 4.0 + (code % 10) * 0.1;
    const reviews = 50 + (code * 17) % 500;
    return { rating: rating.toFixed(1), reviews };
  };

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage onBackToMarketplace={() => navigate("/")} />} />
      
      <Route
        path="*"
        element={
          <div className="bg-[#eaeded] min-h-screen font-sans antialiased text-[#0f1111] flex flex-col">
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

            {/* Sub-Header links bar */}
            <SubHeader />

            <Routes>
              {/* Marketplace Catalog List */}
              <Route
                path="/"
                element={
                  <>
                    {/* Main Hero Banner */}
                    <HeroSection />

                    {/* Products List Section */}
                    <main className="max-w-[1500px] mx-auto p-4 pt-10 md:pt-16 relative z-20 flex-1 w-full animate-in fade-in duration-300">
                      {loadingCatalog ? (
                        <div className="bg-white p-24 rounded shadow-sm flex flex-col items-center justify-center gap-3 w-full border border-gray-200">
                          <Loader2 size={36} className="text-[#e77600] animate-spin" />
                          <span className="text-sm text-gray-500 font-medium">Fetching fresh products...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-8 w-full">
                          {/* Heading Banner card */}
                          <div className="bg-white p-6 rounded-sm shadow-sm border border-gray-200">
                            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#0f1111]">
                              Today's Deals & Trending Products
                            </h2>
                            <p className="text-xs text-gray-500 mt-1.5 font-medium">
                              Shop our top picks and daily discounts in Grocery & Gourmet Foods
                            </p>
                          </div>
                          {/* Catalog Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                            {sortedProducts.map((product) => {
                              const ratingData = getRandomRating(product._id);
                              const hasDiscount = product.MRP > product.Price;
                              const stock = (product as any).stock ?? 999;
                              const isOutOfStock = stock === 0 || localOutOfStock.has(product._id);
                              const isLowStock = stock > 0 && stock <= 5;
                              const recItem = recommendationItems.find((r) => r.product_id === product._id);
                              return (
                                <div
                                  key={product._id}
                                  onClick={() => navigate(`/product/${product._id}`)}
                                  className={`bg-white p-4 rounded-sm flex flex-col justify-between shadow-sm hover:shadow-md transition duration-200 group cursor-pointer border ${isOutOfStock ? "border-red-200 opacity-75" : "border-gray-100 hover:border-gray-300"}`}
                                >
                                  <div>
                                    {/* Image with discount badge + stock/recommendation badge */}
                                    <div className="h-[150px] w-full flex items-center justify-center overflow-hidden mb-3 bg-white p-1 rounded-sm relative">
                                      <img
                                        src={product.image_small}
                                        alt={product.Product}
                                        className={`max-h-full max-w-full object-contain group-hover:scale-[1.03] transition duration-200 select-none ${isOutOfStock ? "grayscale" : ""}`}
                                      />
                                      {hasDiscount && !isOutOfStock && (
                                        <span className="absolute top-1.5 left-1.5 bg-[#cc0c39] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                                          {Math.round(((product.MRP - product.Price) / product.MRP) * 100)}% Off
                                        </span>
                                      )}
                                      {isOutOfStock && (
                                        <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                                          Out of Stock
                                        </span>
                                      )}
                                      {isLowStock && !isOutOfStock && (
                                        <span className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                                          Only {stock} left
                                        </span>
                                      )}
                                      {recItem && !isOutOfStock && (
                                        <span className="absolute bottom-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                                          ⟳ Buy Again
                                        </span>
                                      )}
                                    </div>

                                    {/* Brand & Name */}
                                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5 tracking-wide uppercase truncate">
                                      {product.Brand}
                                    </span>
                                    <h3 className="text-sm text-[#0f1111] font-semibold leading-snug group-hover:text-[#007185] line-clamp-2 mb-1.5 min-h-[40px]">
                                      {product.Product}
                                    </h3>

                                    {/* Star Ratings */}
                                    <div className="flex items-center gap-1 text-xs mb-1.5">
                                      <span className="text-orange-500 font-bold">{ratingData.rating}</span>
                                      <Star size={12} className="fill-orange-400 text-orange-400 inline" />
                                      <span className="text-gray-400">({ratingData.reviews})</span>
                                    </div>

                                    {/* Packing / Quantity */}
                                    <span className="text-xs text-gray-500 font-medium block mb-2 truncate">
                                      {product.Quantity}
                                    </span>
                                  </div>

                                  {/* Price Tag & Add-to-Cart trigger */}
                                  <div className="mt-2 flex flex-col gap-3">
                                    <div className="flex flex-col">
                                      <div className="flex items-baseline gap-1.5 flex-wrap">
                                        <span className="text-lg font-bold text-gray-900">₹{product.Price}</span>
                                        {hasDiscount && (
                                          <span className="text-xs text-gray-400 line-through">₹{product.MRP}</span>
                                        )}
                                      </div>
                                    </div>

                                     {/* Direct Add to Cart Button or Quantity Selector */}
                                     {(() => {
                                       if (isOutOfStock) {
                                         return (
                                           <button
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               navigate(`/product/${product._id}`, { state: { scrollToSimilar: true } });
                                             }}
                                             className="w-full bg-[#f0f2f2] hover:bg-[#e3e6e6] text-[#0f1111] py-1.5 rounded-full text-xs font-semibold border border-gray-300 transition cursor-pointer"
                                           >
                                             See Similar Product
                                           </button>
                                         );
                                       }
                                       const cartItem = cartItems.find((item) => item.product_id === product._id);
                                       if (cartItem) {
                                         const atMax = cartItem.quantity >= stock;
                                         return (
                                           <div className="flex items-center justify-between w-full h-[28px] border border-gray-300 rounded-full overflow-hidden select-none bg-gray-50">
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
                                               className="bg-[#f0f2f2] hover:bg-[#e3e6e6] active:bg-[#d8dbdb] text-[#0f1111] px-3 h-full font-bold active:scale-[0.95] cursor-pointer transition text-sm flex items-center justify-center rounded-l-full"
                                             >
                                               -
                                             </button>
                                             <span className="text-xs font-bold text-[#0f1111] flex-1 text-center">
                                               {cartItem.quantity}
                                             </span>
                                             <button
                                               onClick={async (e) => {
                                                 e.stopPropagation();
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
                                               disabled={atMax}
                                               className="bg-[#f0f2f2] hover:bg-[#e3e6e6] active:bg-[#d8dbdb] text-[#0f1111] px-3 h-full font-bold active:scale-[0.95] cursor-pointer transition text-sm flex items-center justify-center rounded-r-full disabled:opacity-40 disabled:cursor-not-allowed"
                                             >
                                               +
                                             </button>
                                           </div>
                                         );
                                       }
                                       return (
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
                                           className="w-full bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#f0b800] text-[#0f1111] py-1.5 rounded-full text-xs font-semibold cursor-pointer border border-[#f5c200] transition active:scale-[0.97]"
                                         >
                                           Add to Cart
                                         </button>
                                       );
                                     })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination Controls */}
                          {pagination && pagination.total_pages > 1 && (
                            <div className="flex items-center justify-center gap-3 bg-white py-3.5 px-6 rounded shadow-sm max-w-max mx-auto text-sm select-none border border-gray-200">
                              <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => p - 1)}
                                className="px-4 py-1.5 border border-gray-300 rounded bg-[#f0f2f2] hover:bg-[#e3e6e6] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition font-semibold text-xs shadow-sm"
                              >
                                Previous
                              </button>
                              <span className="font-bold text-gray-600">
                                Page {currentPage} of {pagination.total_pages}
                              </span>
                              <button
                                disabled={currentPage === pagination.total_pages}
                                onClick={() => setCurrentPage((p) => p + 1)}
                                className="px-4 py-1.5 border border-gray-300 rounded bg-[#f0f2f2] hover:bg-[#e3e6e6] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition font-semibold text-xs shadow-sm"
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </main>

                    {/* Out of Stock Popup for Homepage Grid */}
                    {stockErrorPopup && (
                      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg p-6 max-w-sm w-full flex flex-col items-center text-center gap-4 animate-in zoom-in-95">
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
                              className="w-full py-2.5 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-semibold rounded-full border border-[#f5c200] transition cursor-pointer"
                            >
                              See Similar Products
                            </button>
                            <button
                              onClick={() => setStockErrorPopup(null)}
                              className="w-full py-2.5 bg-[#f0f2f2] hover:bg-[#e3e6e6] text-[#0f1111] font-semibold rounded-full border border-gray-300 transition cursor-pointer"
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
