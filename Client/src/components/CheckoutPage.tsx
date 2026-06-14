import { useState, useEffect, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { placeOrder } from "../features/order/orderSlice";
import { fetchCart } from "../features/cart/cartSlice";
import { fetchRecommendations } from "../features/recommendations/recommendationSlice";
import { type Product } from "./ProductPage";
import { Loader2, ShieldCheck, MapPin, CreditCard, Truck, ChevronLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface CheckoutItem {
  product_id: string;
  quantity: number;
  unit_price?: number;
}

export const CheckoutPage: FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { cart } = useSelector((state: RootState) => state.cart);
  const { loading: orderLoading } = useSelector((state: RootState) => state.order);

  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [placingOrder, setPlacingOrder] = useState(false);

  // Address form state
  const [addressLine, setAddressLine] = useState(
    user?.addresses?.[0]?.address_line || "406, Mahatma Gandhi Rd, Haridevpur, Shanthala Nagar, Ashok Nagar"
  );
  const [city, setCity] = useState(user?.addresses?.[0]?.city || "Bengaluru");
  const [state, setState] = useState(user?.addresses?.[0]?.state || "Karnataka");
  const [zipCode, setZipCode] = useState(user?.addresses?.[0]?.zip_code || "560001");

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  // Determine items source: "buyNow" from location state, or cart items
  const buyNowData = (location.state as { buyNow?: boolean; product_id?: string; quantity?: number; price?: number }) || {};
  const isBuyNow = buyNowData.buyNow === true;

  const checkoutItems: CheckoutItem[] = isBuyNow
    ? [{ product_id: buyNowData.product_id!, quantity: buyNowData.quantity || 1, unit_price: buyNowData.price }]
    : (cart?.items || []).map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

  // Fetch product details for checkout items
  useEffect(() => {
    if (checkoutItems.length === 0) return;

    const missingIds = checkoutItems
      .map((item) => item.product_id)
      .filter((id) => id && !productDetails[id]);

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
            console.error(`Error fetching product ${id}:`, err);
          }
        })
      );
      setProductDetails(newDetails);
    };

    fetchDetails();
  }, [checkoutItems, productDetails, apiBaseUrl]);

  // Calculate totals
  const itemTotal = checkoutItems.reduce((acc, item) => {
    const product = productDetails[item.product_id];
    const price = item.unit_price || product?.Price || 0;
    return acc + price * item.quantity;
  }, 0);

  const deliveryFee = itemTotal >= 499 ? 0 : 39;
  const grandTotal = itemTotal + deliveryFee;

  const handleConfirmOrder = async () => {
    if (checkoutItems.length === 0) return;
    if (!addressLine.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      alert("Please fill in all address fields.");
      return;
    }

    setPlacingOrder(true);
    try {
      const orderPayload = {
        items: checkoutItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        delivery_location: {
          type: "HOME" as const,
          address_line: addressLine,
          city,
          state,
          zip_code: zipCode,
          latitude: 19.076,
          longitude: 72.8777,
          is_default: true,
        },
      };

      const result = await dispatch(placeOrder(orderPayload)).unwrap();
      if (result) {
        dispatch(fetchCart());
        // Delay fetching recommendations to give background workers time to update Redis
        setTimeout(() => {
          dispatch(fetchRecommendations());
        }, 1500);
        navigate("/order-confirmation");
      }
    } catch (err) {
      console.error("Error placing order:", err);
      alert("Failed to place order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="max-w-[1100px] mx-auto p-4 md:py-12 flex flex-col items-center justify-center min-h-[400px] bg-white mt-6 rounded shadow-sm border border-gray-200 gap-4">
        <ShieldCheck size={48} className="text-gray-400" />
        <h2 className="text-xl font-bold">Please Sign In to Checkout</h2>
        <button
          onClick={() => navigate("/auth")}
          className="px-8 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition"
        >
          Sign In Now
        </button>
      </main>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <main className="max-w-[1100px] mx-auto p-4 md:py-12 flex flex-col items-center justify-center min-h-[400px] bg-white mt-6 rounded shadow-sm border border-gray-200 gap-4">
        <ShieldCheck size={48} className="text-gray-300" />
        <h2 className="text-xl font-bold">Nothing to checkout</h2>
        <p className="text-sm text-gray-500">Add items to your cart or use Buy Now to proceed.</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition"
        >
          Continue Shopping
        </button>
      </main>
    );
  }

  const isBusy = orderLoading || placingOrder;

  return (
    <main className="max-w-[1100px] mx-auto p-4 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans select-none text-[#0f1111] flex-1 w-full">
      {/* Left: Address + Items */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-5">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="self-start text-[#007185] hover:text-[#c45500] hover:underline text-xs font-semibold flex items-center gap-0.5 cursor-pointer"
        >
          <ChevronLeft size={14} /> Back
        </button>

        <h1 className="text-2xl md:text-3xl font-bold">Checkout</h1>

        {/* Delivery Address Section */}
        <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">
            <MapPin size={18} className="text-[#e77600]" /> Delivery Address
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Address Line</label>
              <input
                type="text"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="House no, Street, Landmark"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#e77600] transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#e77600] transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#e77600] transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">PIN Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="6-digit PIN"
                maxLength={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#e77600] transition"
              />
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
          <h2 className="text-base font-bold mb-3">
            Review Items ({checkoutItems.length})
          </h2>
          <div className="flex flex-col divide-y divide-gray-100">
            {checkoutItems.map((item) => {
              const product = productDetails[item.product_id];
              const price = item.unit_price || product?.Price || 0;
              return (
                <div key={item.product_id} className="py-3 flex gap-3">
                  <div className="w-[70px] h-[70px] flex items-center justify-center border border-gray-100 p-1.5 bg-white rounded shrink-0">
                    {product ? (
                      <img
                        src={product.image_small}
                        alt={product.Product}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <Loader2 size={14} className="text-gray-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold leading-tight line-clamp-2">
                      {product ? product.Product : "Loading..."}
                    </h4>
                    {product && (
                      <span className="text-xs text-gray-500 mt-0.5 block">{product.Brand} · {product.Quantity}</span>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                      <span>Qty: <span className="font-bold text-[#0f1111]">{item.quantity}</span></span>
                      <span>₹{price} × {item.quantity} = <span className="font-bold text-[#0f1111]">₹{(price * item.quantity).toFixed(2)}</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
          <h2 className="text-base font-bold mb-2 flex items-center gap-2">
            <CreditCard size={18} className="text-[#e77600]" /> Payment Method
          </h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="payment" defaultChecked className="accent-[#e77600]" />
              Cash on Delivery (COD)
            </label>
          </div>
        </div>
      </div>

      {/* Right: Order Summary */}
      <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-sm border border-gray-200 shadow-sm flex flex-col gap-4 sticky top-20">
        <h2 className="text-lg font-bold border-b border-gray-200 pb-2">Order Summary</h2>

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Items ({checkoutItems.reduce((a, i) => a + i.quantity, 0)})</span>
            <span className="font-semibold">₹{itemTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 flex items-center gap-1"><Truck size={13} /> Delivery</span>
            <span className={`font-semibold ${deliveryFee === 0 ? "text-green-600" : ""}`}>
              {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3 flex justify-between text-base font-bold">
          <span>Order Total</span>
          <span className="text-lg text-[#b12704]">₹{grandTotal.toFixed(2)}</span>
        </div>

        <button
          onClick={handleConfirmOrder}
          disabled={isBusy}
          className="w-full bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#e2b800] text-[#0f1111] py-2.5 rounded-lg text-sm font-semibold cursor-pointer border border-[#f5c200] shadow-sm transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {placingOrder ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Placing Order...
            </>
          ) : (
            "Place Your Order"
          )}
        </button>

        <div className="flex items-center gap-2 text-[10px] text-gray-500 leading-snug">
          <ShieldCheck size={14} className="text-green-600 shrink-0" />
          <span>Your payment information is processed securely. By placing your order, you agree to Amazon's privacy notice and conditions of use.</span>
        </div>
      </div>
    </main>
  );
};
