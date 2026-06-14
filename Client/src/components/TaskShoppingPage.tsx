import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { addItemToCart, updateItemQty, optimisticAddItem, optimisticUpdateQty, optimisticRemoveItem, removeItem, fetchCart } from "../features/cart/cartSlice";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import type { Product } from "./ProductPage";

export const TaskShoppingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const taskQuery = searchParams.get("task") || "";
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartItems = useSelector((state: RootState) => state.cart.cart?.items || []);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const recommendationItems = useSelector((state: RootState) => state.recommendations?.items || []);

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  const [stockErrorPopup, setStockErrorPopup] = useState<string | null>(null);
  const [localOutOfStock, setLocalOutOfStock] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!taskQuery) return;

    const fetchTaskShoppingResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/task-shopping?task=${encodeURIComponent(taskQuery)}`);
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || "Failed to generate shopping list");
        }
        
        if (json.success) {
          setProducts(json.data || []);
          setItems(json.items || []);
        } else {
          throw new Error("Generation failed");
        }
      } catch (err: any) {
        console.error("Error fetching task shopping results:", err);
        setError(err.message || "Something went wrong while consulting the AI.");
      } finally {
        setLoading(false);
      }
    };

    if (navigator.onLine) {
      fetchTaskShoppingResults();
    } else {
      setLoading(false);
    }
  }, [taskQuery, apiBaseUrl]);

  const getRandomRating = (productId: string) => {
    const code = productId.charCodeAt(productId.length - 1) || 5;
    const rating = 4.0 + (code % 10) * 0.1;
    const reviews = 50 + (code * 17) % 500;
    return { rating: rating.toFixed(1), reviews };
  };

  const sortedProducts = (() => {
    if (!isAuthenticated || !recommendationItems || recommendationItems.length === 0) return products;
    const scoreMap = new Map<string, number>();
    recommendationItems.forEach((rec) => scoreMap.set(rec.product_id, rec.score));
    return [...products].sort((a, b) => (scoreMap.get(b._id) || 0) - (scoreMap.get(a._id) || 0));
  })();

  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-6 w-full animate-in fade-in duration-300 relative z-20">
      <div className="mb-6 bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <h1 className="text-xl md:text-2xl font-bold text-[#0f1111]">
          Shopping List for: "{taskQuery}"
        </h1>
        {items.length > 0 && !loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm font-semibold text-gray-700 self-center mr-2">AI Suggested Items:</span>
            {items.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f0f2f2] text-[#0f1111] text-sm rounded-full border border-gray-300 font-medium">
                <CheckCircle2 size={14} className="text-[#007185]" />
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-24 rounded shadow-sm flex flex-col items-center justify-center gap-4 w-full border border-gray-200">
          <Loader2 size={40} className="text-[#e77600] animate-spin" />
          <span className="text-lg text-[#0f1111] font-semibold">Consulting AI Assistant...</span>
          <span className="text-sm text-gray-500">Generating the perfect shopping list and finding products</span>
        </div>
      ) : error ? (
        <div className="bg-white p-24 rounded shadow-sm flex flex-col items-center justify-center gap-4 w-full border border-gray-200">
          <span className="text-red-600 font-semibold text-lg">{error}</span>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white p-12 rounded shadow-sm flex flex-col items-center justify-center gap-4 w-full border border-gray-200">
          <span className="text-gray-700 font-semibold text-lg">No products found for "{taskQuery}"</span>
          <p className="text-sm text-gray-500">Try rephrasing your task</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {sortedProducts.map((product) => {
            const ratingData = getRandomRating(product._id);
            const cartItem = cartItems.find((item) => item.product_id === product._id);
            const quantityInCart = cartItem ? cartItem.quantity : 0;
            const stock = (product as any).stock ?? 999;
            const atMax = quantityInCart >= stock;
            
            const displayPrice = cartItem ? cartItem.unit_price : product.Price;
            const displayMRP = cartItem ? (cartItem.unit_price > product.MRP ? cartItem.unit_price : product.MRP) : product.MRP;
            const hasDiscount = displayMRP > displayPrice;
            const discountPct = hasDiscount ? Math.round(((displayMRP - displayPrice) / displayMRP) * 100) : 0;
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
                  {/* Image with discount badge + stock badge */}
                  <div className="h-[150px] w-full flex items-center justify-center overflow-hidden mb-3 bg-white p-1 rounded-sm relative">
                    <img
                      src={product.image_small}
                      alt={product.Product}
                      className={`max-h-full max-w-full object-contain group-hover:scale-[1.03] transition duration-200 select-none ${isOutOfStock ? "grayscale" : ""}`}
                    />
                    {hasDiscount && !isOutOfStock && (
                      <span className="absolute top-1.5 left-1.5 bg-[#cc0c39] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                        {discountPct}% Off
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
                      <span className="text-lg font-bold text-gray-900">₹{displayPrice}</span>
                      {hasDiscount && (
                        <span className="text-xs text-gray-400 line-through">₹{displayMRP}</span>
                      )}
                    </div>
                  </div>

                  {/* Direct Add to Cart Button or Quantity Selector */}
                  {isOutOfStock ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/product/${product._id}`);
                      }}
                      className="w-full bg-[#f0f2f2] hover:bg-[#e3e6e6] text-[#0f1111] py-1.5 rounded-full text-xs font-semibold border border-gray-300 transition cursor-pointer"
                    >
                      See Similar Product
                    </button>
                  ) : quantityInCart > 0 ? (
                    <div className="flex items-center justify-between w-full h-[28px] border border-gray-300 rounded-full overflow-hidden select-none bg-gray-50">
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
                        className="bg-[#f0f2f2] hover:bg-[#e3e6e6] active:bg-[#d8dbdb] text-[#0f1111] px-3 h-full font-bold active:scale-[0.95] cursor-pointer transition text-sm flex items-center justify-center rounded-l-full"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-[#0f1111] flex-1 text-center">
                        {quantityInCart}
                      </span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
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
                        disabled={atMax}
                        className="bg-[#f0f2f2] hover:bg-[#e3e6e6] active:bg-[#d8dbdb] text-[#0f1111] px-3 h-full font-bold active:scale-[0.95] cursor-pointer transition text-sm flex items-center justify-center rounded-r-full disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Out of Stock Popup */}
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
                  navigate(`/product/${stockErrorPopup}`);
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
    </div>
  );
};
