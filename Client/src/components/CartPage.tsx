import { useState, useEffect, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { updateItemQty, removeItem, clearCartItems } from "../features/cart/cartSlice";
import { type Product } from "./ProductPage";
import { Trash2, Loader2, ShoppingBag, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CartPage: FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { cart, loading } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

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
                  <div className="flex-1 flex flex-col justify-between">
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
                          onChange={(e) =>
                            dispatch(
                              updateItemQty({
                                product_id: item.product_id,
                                quantity: Number(e.target.value),
                              })
                            )
                          }
                          className="border border-gray-300 rounded bg-[#f0f2f2] px-2 py-1 outline-none cursor-pointer text-xs font-semibold disabled:opacity-60 transition"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <option key={num} value={num}>
                              {num}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete Trigger */}
                      <button
                        disabled={isBusy}
                        onClick={() => dispatch(removeItem(item.product_id))}
                        className="text-[#007185] hover:text-[#c45500] hover:underline flex items-center gap-1 font-semibold cursor-pointer border-l border-gray-200 pl-4 disabled:opacity-60 transition"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
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
            disabled={isBusy}
            className="w-full bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#e2b800] text-[#0f1111] py-2 rounded-lg text-xs md:text-sm font-semibold cursor-pointer border border-[#f5c200] shadow-sm transition active:scale-[0.98] mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Proceed to Buy
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
