import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { addItemToCart, updateItemQty, optimisticAddItem, optimisticUpdateQty, optimisticRemoveItem, removeItem, fetchCart } from "../features/cart/cartSlice";
import { Loader2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "./ProductPage";

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartItems = useSelector((state: RootState) => state.cart.cart?.items || []);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const recommendationItems = useSelector((state: RootState) => state.recommendations?.items || []);

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  const [stockErrorPopup, setStockErrorPopup] = useState<string | null>(null);
  const [localOutOfStock, setLocalOutOfStock] = useState<Set<string>>(new Set());
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query && !category) return;

    const fetchSearchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        let endpoint = "";
        if (category) {
          endpoint = `${apiBaseUrl}/search-category?category=${encodeURIComponent(category)}`;
        } else if (query) {
          endpoint = `${apiBaseUrl}/search?q=${encodeURIComponent(query)}`;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch search results");
        const json = await res.json();
        if (json.success) {
          setProducts(json.data || []);
        } else {
          throw new Error("Search failed");
        }
      } catch (err: any) {
        console.error("Error fetching search results:", err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    if (navigator.onLine) {
      fetchSearchResults();
    } else {
      setLoading(false);
    }
  }, [query, category, apiBaseUrl]);

  const sortedProducts = (() => {
    if (!isAuthenticated || !recommendationItems || recommendationItems.length === 0) return products;
    const scoreMap = new Map<string, number>();
    recommendationItems.forEach((rec) => scoreMap.set(rec.product_id, rec.score));
    return [...products].sort((a, b) => (scoreMap.get(b._id) || 0) - (scoreMap.get(a._id) || 0));
  })();

  const slideProducts = (dir: 'left' | 'right') => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6 w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#0f1111]">
            {category ? category : `Results for "${query}"`}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {products.length} {products.length === 1 ? "result" : "results"} found
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-[#007185] hover:text-[#c45500] font-medium hidden sm:inline cursor-pointer"
        >
          ‹ Back to Home
        </button>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 w-full">
          <Loader2 size={36} className="text-[#49a353] animate-spin" />
          <span className="text-sm text-gray-500 font-medium">Searching products...</span>
        </div>
      ) : error ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4 w-full">
          <span className="text-red-600 font-semibold text-lg">{error}</span>
        </div>
      ) : products.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-4 w-full">
          <span className="text-gray-700 font-semibold text-lg">No results for {category ? `category "${category}"` : `"${query}"`}</span>
          <p className="text-sm text-gray-500">Try checking your spelling or use more general terms</p>
        </div>
      ) : (
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
            className="overflow-x-auto scrollbar-hide flex flex-wrap gap-4 scroll-smooth pb-2"
          >
            {sortedProducts.map((product) => {
              const stock = (product as any).stock ?? 999;
              const isOutOfStock = stock === 0 || localOutOfStock.has(product._id);
              const isLowStock = stock > 0 && stock <= 5;
              const recItem = recommendationItems.find((r) => r.product_id === product._id);
              const cartItem = cartItems.find((item) => item.product_id === product._id);
              const quantityInCart = cartItem ? cartItem.quantity : 0;

              const displayPrice = cartItem ? cartItem.unit_price : product.Price;
              const displayMRP = cartItem ? (cartItem.unit_price > product.MRP ? cartItem.unit_price : product.MRP) : product.MRP;
              const hasDiscount = displayMRP > displayPrice;
              const discountPct = hasDiscount ? Math.round(((displayMRP - displayPrice) / displayMRP) * 100) : 0;

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
                      {discountPct}% Off
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

                    {/* Green + Button */}
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

                    {/* Quantity stepper */}
                    {!isOutOfStock && cartItem && (
                      <div className="absolute bottom-0 right-3 flex items-center h-8 bg-[#49a353] rounded-full shadow-md overflow-hidden z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (quantityInCart === 1) {
                              dispatch(optimisticRemoveItem(product._id));
                              dispatch(removeItem(product._id));
                            } else {
                              dispatch(optimisticUpdateQty({ product_id: product._id, quantity: quantityInCart - 1 }));
                              dispatch(updateItemQty({ product_id: product._id, quantity: quantityInCart - 1 }));
                            }
                          }}
                          className="text-white px-2 h-full font-bold cursor-pointer transition text-sm flex items-center justify-center hover:bg-[#3d8b46] active:scale-90"
                        >
                          −
                        </button>
                        <span className="text-white text-xs font-bold px-2">
                          {quantityInCart}
                        </span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const atMax = quantityInCart >= stock;
                            if (!atMax) {
                              dispatch(optimisticUpdateQty({ product_id: product._id, quantity: quantityInCart + 1 }));
                              try {
                                await dispatch(updateItemQty({ product_id: product._id, quantity: quantityInCart + 1 })).unwrap();
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
                        className="absolute bottom-0 right-3 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[9px] font-semibold px-2 py-1 rounded-full cursor-pointer transition z-10"
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
                      <span className="text-sm font-bold text-[#0f1111]">₹{displayPrice}</span>
                      {hasDiscount && (
                        <span className="text-[10px] text-gray-400 line-through">₹{displayMRP}</span>
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
      )}

      {/* Out of Stock Popup */}
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
    </div>
  );
};
