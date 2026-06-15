import { useState, useEffect, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { updateItemQty, removeItem, clearCartItems, optimisticUpdateQty, optimisticRemoveItem, optimisticAddItem, addItemToCart } from "../features/cart/cartSlice";
import { fetchCartStatus } from "../features/cart/cartStabilitySlice";
import { CartStabilityBanner } from "./CartStabilityBanner";
import { type Product } from "./ProductPage";
import { Trash2, Loader2, ShoppingBag, ChevronLeft, Sparkles, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const SubstituteSlider: FC<{ productId: string }> = ({ productId }) => {
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [details, setDetails] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  useEffect(() => {
    const fetchSubstitutes = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/products/${productId}/substitutes`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setSubstitutes(json.data);
            
            const detailRes = await fetch(`${apiBaseUrl}/products/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_ids: json.data.map((s: any) => s._id?.$oid || s.id) })
            });
            if (detailRes.ok) {
              const dJson = await detailRes.json();
              if (dJson.success) {
                const detMap: Record<string, Product> = {};
                dJson.data.forEach((p: Product) => {
                  detMap[p._id] = p;
                });
                setDetails(detMap);
              }
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubstitutes();
  }, [productId, apiBaseUrl]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded"></div>;
  if (substitutes.length === 0) return <p className="text-xs text-gray-500">No substitutes found.</p>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
      {substitutes.map(sub => {
        const subId = sub._id?.$oid || sub.id;
        const detail = details[subId];
        const image = detail?.image_small || "https://via.placeholder.com/150";
        return (
          <div key={subId} className="w-[140px] shrink-0 border border-gray-200 rounded p-2 flex flex-col justify-between cursor-pointer hover:shadow-md transition bg-white"
            onClick={() => navigate(`/product/${subId}`)}>
            <img src={image} className="w-full h-[80px] object-contain mb-2" alt={sub.name} />
            <span className="text-[10px] text-gray-500 line-clamp-1 uppercase tracking-wide">{sub.brand}</span>
            <span className="text-xs font-semibold line-clamp-2 leading-tight mb-1">{sub.name}</span>
            <div className="flex flex-col gap-1 mt-auto">
              <span className="font-bold text-sm">₹{sub.price}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isAuthenticated) navigate("/auth");
                  else {
                    dispatch(optimisticAddItem({ product_id: subId, quantity: 1, unit_price: sub.price }));
                    dispatch(addItemToCart({ product_id: subId, quantity: 1 }));
                  }
                }}
                className="w-full bg-[#ffd814] hover:bg-[#f7ca00] py-1 text-[10px] font-semibold rounded-full border border-[#f5c200] transition active:scale-95">
                Add to Cart
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const CartPage: FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const outOfStockItems = location.state?.outOfStockItems || [];

  const { cart, loading } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const favCategories = useSelector((state: RootState) => state.favCategory.categories);
  const { staleItems } = useSelector((state: RootState) => state.cartStability);

  const [favProducts, setFavProducts] = useState<Product[]>([]);
  const [loadingFavProducts, setLoadingFavProducts] = useState(false);

  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [localOutOfStock, setLocalOutOfStock] = useState<Set<string>>(new Set());

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  // Fetch cart status on mount
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCartStatus());
    }
  }, [isAuthenticated, dispatch]);

  // Fetch product details for items in the cart that we don't have cached yet
  useEffect(() => {
    if (!isAuthenticated || !cart || !cart.items || cart.items.length === 0) return;

    const missingIds = cart.items
      .map((item) => item.product_id)
      .filter((id) => !productDetails[id]);

    if (missingIds.length === 0) return;

    const fetchDetails = async () => {
      const newDetails = { ...productDetails };

      await Promise.all(
        missingIds.map(async (id) => {
          try {
            const res = await fetch(`${apiBaseUrl}/products/${id}`);
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                newDetails[id] = json.data;
              }
            }
          } catch (err) {
            console.error(`Error fetching detail for product ${id}:`, err);
          }
        })
      );
      setProductDetails(newDetails);
    };

    fetchDetails();
  }, [cart, productDetails, isAuthenticated, apiBaseUrl]);

  // Fetch favorite products
  useEffect(() => {
    if (!isAuthenticated || favCategories.length === 0) {
      setFavProducts([]);
      return;
    }

    const fetchFavProducts = async () => {
      setLoadingFavProducts(true);
      try {
        const res = await fetch(`${apiBaseUrl}/products/categories?page=1&limit=4`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ categories: favCategories }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setFavProducts(json.data || []);
          }
        }
      } catch (err) {
        console.error("Error fetching favorite products:", err);
      } finally {
        setLoadingFavProducts(false);
      }
    };

    fetchFavProducts();
  }, [favCategories, isAuthenticated, apiBaseUrl]);

  // If user is not logged in
  if (!isAuthenticated) {
    return (
      <main className="max-w-[1500px] mx-auto p-4 md:py-12 flex flex-col items-center justify-center min-h-[400px] bg-white mt-6 rounded shadow-sm border border-gray-200">
        <ShoppingBag size={48} className="text-gray-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Please Sign In to view your Cart</h2>
        <p className="text-sm text-gray-500 mb-6">You need to be signed in to add items and manage your shopping cart.</p>
        <button
          onClick={() => navigate("/auth")}
          className="px-8 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition active:scale-[0.98]"
        >
          Sign In Now
        </button>
      </main>
    );
  }

  const itemsCount = cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
  const isCartEmpty = !cart || !cart.items || cart.items.length === 0;
  const isBusy = loading;

  // Check if any item exceeds available stock
  const hasStockIssue = cart?.items?.some((item) => {
    const product = productDetails[item.product_id];
    if (product && product.stock !== undefined && item.quantity > product.stock) return true;
    if (product && product.stock === 0) return true;
    return false;
  }) || false;

  return (
    <main className="max-w-[1500px] mx-auto p-4 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans select-none text-[#0f1111] flex-1 w-full">
      {/* Left Area: Cart items listing */}
      <div className="col-span-12 lg:col-span-9 bg-white p-5 rounded-sm border border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-baseline border-b border-gray-200 pb-3 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium">Shopping Cart</h1>
            {!isCartEmpty && (
              <button
                onClick={() => dispatch(clearCartItems())}
                className="text-[#007185] hover:text-[#c45500] hover:underline text-xs font-semibold mt-1 cursor-pointer"
              >
                Deselect all items (Clear Cart)
              </button>
            )}
          </div>
          <span className="text-sm text-gray-500 font-semibold self-end">Price</span>
        </div>

        {loading && isCartEmpty ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2">
            <Loader2 size={32} className="text-[#e77600] animate-spin" />
            <span className="text-xs text-gray-500 font-medium">Loading your shopping cart...</span>
          </div>
        ) : isCartEmpty ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag size={52} className="text-gray-300" />
            <div>
              <h2 className="text-xl font-bold mb-1">Your Amazon Cart is empty.</h2>
              <p className="text-xs text-gray-500">Your shopping cart lives to serve. Give it purpose — fill it with groceries, treats, and snacks!</p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-150">
            {cart.items.map((item) => {
              const product = productDetails[item.product_id];
              const hasDiscount = product && product.MRP > product.Price;

              return (
                <div key={item.product_id} className="py-5 flex gap-4 first:pt-2 last:pb-2">
                  {/* Product Thumbnail */}
                  <div className="w-[100px] h-[100px] md:w-[130px] md:h-[130px] flex items-center justify-center border border-gray-100 p-2 bg-white rounded shrink-0">
                    {product ? (
                      <img
                        src={product.image_small}
                        alt={product.Product}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <Loader2 size={18} className="text-gray-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Product Description */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        {product ? (
                          <h3 
                            onClick={() => navigate(`/product/${product._id}`)}
                            className="text-sm md:text-base font-semibold leading-tight hover:text-[#007185] cursor-pointer line-clamp-2"
                          >
                            {product.Product}
                          </h3>
                        ) : (
                          <div className="h-4 w-48 bg-gray-100 animate-pulse rounded"></div>
                        )}
                        <span className="text-base font-bold shrink-0">₹{item.unit_price}</span>
                      </div>

                      {product ? (
                        <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                          <span>Brand: {product.Brand}</span>
                          <span>Pack Size: {product.Quantity}</span>
                          {hasDiscount && (
                            <span className="text-green-700 font-semibold">
                              MRP: <span className="line-through">₹{product.MRP}</span> ({Math.round(((product.MRP - product.Price) / product.MRP) * 100)}% Off)
                            </span>
                          )}
                          {product.stock === 0 && (
                            <span className="text-red-600 font-bold">Out of Stock — remove to proceed</span>
                          )}
                          {product.stock !== undefined && product.stock > 0 && product.stock <= 5 && (
                            <span className="text-orange-600 font-semibold">Only {product.stock} left in stock</span>
                          )}
                          {product.stock !== undefined && product.stock > 0 && item.quantity > product.stock && (
                            <span className="text-red-600 font-bold">Reduce qty to {product.stock} or less</span>
                          )}
                        </div>
                      ) : (
                        <div className="h-3 w-32 bg-gray-50 animate-pulse rounded mt-2"></div>
                      )}
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap text-xs">
                      {/* Qty Dropdown */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-gray-500 font-semibold">Qty:</label>
                        <select
                          value={item.quantity}
                          disabled={isBusy}
                          onChange={(e) => {
                            const newQty = Number(e.target.value);
                            dispatch(optimisticUpdateQty({ product_id: item.product_id, quantity: newQty }));
                            dispatch(updateItemQty({ product_id: item.product_id, quantity: newQty }));
                          }}
                          className="border border-gray-300 rounded bg-[#f0f2f2] px-2 py-1 outline-none cursor-pointer text-xs font-semibold disabled:opacity-60 transition"
                        >
                          {Array.from({ length: Math.min(10, product?.stock ?? 10) }, (_, i) => i + 1).map((num) => (
                            <option key={num} value={num}>
                              {num}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete Trigger */}
                      <button
                        disabled={isBusy}
                        onClick={() => {
                          dispatch(optimisticRemoveItem(item.product_id));
                          dispatch(removeItem(item.product_id));
                        }}
                        className="text-[#007185] hover:text-[#c45500] hover:underline flex items-center gap-1 font-semibold cursor-pointer border-l border-gray-200 pl-4 disabled:opacity-60 transition"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>

                    {/* Substitutes for out of stock items */}
                    {product && product.stock === 0 && (
                      <div className="mt-4 bg-red-50 p-3 rounded border border-red-100 w-full overflow-hidden">
                        <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1">
                          <Sparkles size={14} className="text-[#e77600]" />
                          Try these similar items instead:
                        </h4>
                        <SubstituteSlider productId={product._id} />
                      </div>
                    )}

                    {/* Cart Stability Warnings */}
                    {staleItems
                      .filter((s) => s.product_id === item.product_id)
                      .map((staleItem) => (
                        <CartStabilityBanner key={staleItem.product_id + staleItem.type} staleItem={staleItem} />
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-200 pt-3 flex justify-end text-sm md:text-base">
          <span>
            Subtotal ({itemsCount} item{itemsCount !== 1 && "s"}):{" "}
            <span className="font-bold">₹{cart?.subtotal || 0}</span>
          </span>
        </div>

        {outOfStockItems.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-5">
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
              <h3 className="text-sm font-bold text-red-800 mb-1">Items from your reorder are out of stock</h3>
              <p className="text-xs text-red-600">We couldn't add some items to your cart because they are currently unavailable. Check out these smart alternatives instead:</p>
            </div>
            <div className="flex flex-col gap-6">
              {outOfStockItems.map((oosItem: any) => (
                <div key={oosItem._id} className="bg-[#f0f2f2] p-4 rounded-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-[#e77600]" />
                    <p className="text-sm font-bold text-[#0f1111]">Substitutes for: <span className="font-semibold text-gray-700">{oosItem.Product}</span></p>
                  </div>
                  <SubstituteSlider productId={oosItem._id} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorite Products Slider in Cart */}
        {isAuthenticated && favProducts.length > 0 && !loadingFavProducts && (
          <div className="mt-8 border-t border-gray-100 pt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-[#0f1111] flex items-center gap-2">
                From Your Favorite Categories
              </h2>
              <span className="text-sm text-[#007185] hover:text-[#c45500] cursor-pointer font-medium hidden sm:inline" onClick={() => navigate("/")}>
                See more ›
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6 pb-2">
              {favProducts.slice(0, 4).map((product) => {
                const hasDiscount = product.MRP > product.Price;
                const stock = (product as any).stock ?? 999;
                const isOutOfStock = stock === 0 || localOutOfStock.has(product._id);
                const isLowStock = stock > 0 && stock <= 5;
                const cartItem = cart?.items?.find((item) => item.product_id === product._id);
                return (
                  <div
                    key={product._id}
                    onClick={() => navigate(`/product/${product._id}`)}
                    className={`w-full bg-white rounded-lg flex flex-col justify-between transition duration-200 cursor-pointer border relative group/card ${
                      isOutOfStock ? "border-red-200 opacity-70" : "border-gray-200 hover:shadow-md hover:border-gray-300"
                    }`}
                  >
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

                    <div className={`h-[120px] w-full p-2 bg-[#f7f7f7] rounded-t-lg flex items-center justify-center relative overflow-hidden ${isOutOfStock ? "grayscale" : ""}`}>
                      <img
                        src={product.image_small || `https://picsum.photos/seed/${product._id}/300/300`}
                        alt={product.Product}
                        className="max-h-full max-w-full object-contain mix-blend-multiply group-hover/card:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {!isOutOfStock && !cartItem && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          dispatch(optimisticAddItem({ product_id: product._id, quantity: 1, unit_price: product.Price }));
                          try {
                            await dispatch(addItemToCart({ product_id: product._id, quantity: 1 })).unwrap();
                          } catch (error: any) {
                            const errMsg = typeof error === 'string' ? error.toLowerCase() : '';
                            if (errMsg.includes("out of stock") || errMsg.includes("available")) {
                              setLocalOutOfStock(prev => new Set(prev).add(product._id));
                              alert("This item is now out of stock.");
                            } else {
                              alert(error || "Failed to add to cart");
                            }
                          }
                        }}
                        className="absolute bottom-0 right-3 w-8 h-8 bg-[#49a353] hover:bg-[#3d8b46] text-white rounded-full flex items-center justify-center shadow-md transition active:scale-90 cursor-pointer z-10"
                        title="Add to cart"
                      >
                        <Plus size={18} strokeWidth={3} />
                      </button>
                    )}

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
                        <span className="text-white text-xs font-bold px-2">{cartItem.quantity}</span>
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
                                  setLocalOutOfStock(prev => new Set(prev).add(product._id));
                                  alert("This item is now out of stock.");
                                } else {
                                  alert(error || "Failed to update cart");
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

                    <div className="p-3 pt-2 flex flex-col gap-1">
                      <h3 className="text-xs text-[#0f1111] font-medium leading-snug line-clamp-2 min-h-[32px]">
                        {product.Product}
                      </h3>
                      <span className="text-[10px] text-gray-400 truncate">{product.Quantity}</span>
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
          </div>
        )}
      </div>

      {/* Right Area: Checkout subtotal summary panel */}
      {!isCartEmpty && (
        <div className="col-span-12 lg:col-span-3 bg-white p-5 rounded-sm border border-gray-200 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm md:text-base">
            <span>
              Subtotal ({itemsCount} item{itemsCount !== 1 && "s"}):
            </span>
            <span className="text-2xl font-bold">₹{cart?.subtotal || 0}</span>
          </div>

          {(cart?.subtotal || 0) >= 499 ? (
            <div className="flex items-center gap-2 bg-green-50 p-2.5 rounded-sm border border-green-200 text-[11px] text-green-800 font-semibold leading-snug">
              <span className="text-lg">🎉</span>
              <span>Your order qualifies for FREE Delivery!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-yellow-50 p-2.5 rounded-sm border border-yellow-200 text-[11px] text-yellow-800 font-semibold leading-snug">
              <span className="text-lg">🚚</span>
              <span>Add ₹{(499 - (cart?.subtotal || 0)).toFixed(0)} more for FREE delivery (₹39 fee applies)</span>
            </div>
          )}

          <button
            onClick={() => navigate("/checkout")}
            disabled={isBusy || hasStockIssue}
            className="w-full bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#e2b800] text-[#0f1111] py-2 rounded-lg text-xs md:text-sm font-semibold cursor-pointer border border-[#f5c200] shadow-sm transition active:scale-[0.98] mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {hasStockIssue ? "Remove unavailable items to proceed" : "Proceed to Buy"}
          </button>

          <hr className="border-gray-200 my-1" />

          <button
            onClick={() => navigate("/")}
            className="w-full bg-[#f0f2f2] hover:bg-[#e3e6e6] text-[#0f1111] py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-gray-300 shadow-sm transition flex items-center justify-center gap-1"
          >
            <ChevronLeft size={14} /> Continue Shopping
          </button>
        </div>
      )}
    </main>
  );
};
