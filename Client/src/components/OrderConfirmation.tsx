import { useEffect, useState, type FC } from "react";
import { useSelector } from "react-redux";
import { type RootState } from "../app/store";
import { type Product } from "./ProductPage";
import { CheckCircle, Package, Loader2, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const OrderConfirmation: FC = () => {
  const navigate = useNavigate();
  const { lastOrder, loading } = useSelector((state: RootState) => state.order);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  useEffect(() => {
    if (!lastOrder || !lastOrder.items || lastOrder.items.length === 0) return;

    const missingIds = lastOrder.items
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
  }, [lastOrder, productDetails, apiBaseUrl]);

  if (!isAuthenticated) {
    return (
      <main className="max-w-[900px] mx-auto p-4 md:py-12 flex flex-col items-center justify-center min-h-[400px] bg-white mt-6 rounded shadow-sm border border-gray-200">
        <Package size={48} className="text-gray-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Please Sign In</h2>
        <button
          onClick={() => navigate("/auth")}
          className="px-8 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition active:scale-[0.98]"
        >
          Sign In Now
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-[900px] mx-auto p-4 md:py-12 flex flex-col items-center justify-center min-h-[400px] bg-white mt-6 rounded shadow-sm border border-gray-200">
        <Loader2 size={36} className="text-[#e77600] animate-spin mb-4" />
        <span className="text-sm text-gray-500 font-medium">Placing your order...</span>
      </main>
    );
  }

  if (!lastOrder) {
    return (
      <main className="max-w-[900px] mx-auto p-4 md:py-12 flex flex-col items-center justify-center min-h-[400px] bg-white mt-6 rounded shadow-sm border border-gray-200 gap-4">
        <Package size={48} className="text-gray-300" />
        <h2 className="text-xl font-bold">No recent order found</h2>
        <p className="text-sm text-gray-500">Place an order from your cart to see confirmation here.</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition"
        >
          Continue Shopping
        </button>
      </main>
    );
  }

  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + 2);
  const formattedDate = estimatedDate.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="max-w-[900px] mx-auto p-4 md:py-8 flex flex-col gap-6 font-sans select-none text-[#0f1111] flex-1 w-full">
      {/* Success Header */}
      <div className="bg-white p-6 md:p-8 rounded-sm border border-gray-200 shadow-sm text-center flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-400 flex items-center justify-center mb-1">
          <CheckCircle size={36} className="text-green-500" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-green-700">Order Placed Successfully!</h1>
        <p className="text-sm text-gray-500 max-w-md">
          Thank you for your purchase. Your order <span className="font-bold text-[#0f1111]">#{lastOrder.order_id}</span> has been confirmed.
        </p>

        <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-sm border border-blue-200 text-xs text-blue-800 font-semibold mt-2">
          <Truck size={16} />
          <span>Estimated delivery by <span className="font-bold">{formattedDate}</span></span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold mb-4 border-b border-gray-200 pb-2">Order Summary</h2>

        <div className="flex flex-col divide-y divide-gray-100">
          {lastOrder.items.map((item) => {
            const product = productDetails[item.product_id];
            return (
              <div key={item.product_id} className="py-4 flex gap-4 first:pt-1 last:pb-1">
                <div className="w-[80px] h-[80px] flex items-center justify-center border border-gray-100 p-1.5 bg-white rounded shrink-0">
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

                <div className="flex-1">
                  <h3 className="text-sm font-semibold leading-tight line-clamp-2">
                    {product ? product.Product : "Loading..."}
                  </h3>
                  {product && (
                    <span className="text-xs text-gray-500 mt-0.5 block">{product.Brand} · {product.Quantity}</span>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                    <span>Qty: <span className="font-bold text-[#0f1111]">{item.quantity}</span></span>
                    <span>Price: <span className="font-bold text-[#0f1111]">₹{item.unit_price}</span></span>
                    <span>Subtotal: <span className="font-bold text-[#0f1111]">₹{item.subtotal}</span></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 pt-4 mt-2 flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Item Total</span>
            <span className="font-semibold">₹{lastOrder.item_total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Delivery Fee</span>
            <span className={`font-semibold ${lastOrder.delivery_fee === 0 ? "text-green-600" : ""}`}>
              {lastOrder.delivery_fee === 0 ? "FREE" : `₹${lastOrder.delivery_fee}`}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
            <span className="font-bold text-base">Grand Total</span>
            <span className="font-bold text-lg">₹{lastOrder.grand_total}</span>
          </div>
        </div>
      </div>

      {/* Delivery Address */}
      {lastOrder.delivery_location && (
        <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold mb-2">Delivery Address</h2>
          <div className="text-sm text-gray-700 leading-relaxed">
            <p className="font-semibold capitalize">{lastOrder.delivery_location.type}</p>
            <p>{lastOrder.delivery_location.address_line}</p>
            <p>{lastOrder.delivery_location.city}, {lastOrder.delivery_location.state} - {lastOrder.delivery_location.zip_code}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => navigate("/")}
          className="flex-1 bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#e2b800] text-[#0f1111] py-2.5 rounded-lg text-sm font-semibold cursor-pointer border border-[#f5c200] shadow-sm transition active:scale-[0.98]"
        >
          Continue Shopping
        </button>
        <button
          onClick={() => navigate("/orders")}
          className="flex-1 bg-[#f0f2f2] hover:bg-[#e3e6e6] text-[#0f1111] py-2.5 rounded-lg text-sm font-semibold cursor-pointer border border-gray-300 shadow-sm transition flex items-center justify-center gap-1.5"
        >
          <Package size={15} /> View My Orders
        </button>
      </div>
    </main>
  );
};
