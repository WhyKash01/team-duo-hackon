import { useEffect, useState, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { fetchUserOrders } from "../features/order/orderSlice";
import { optimisticAddItem, addItemToCart, clearCartItems } from "../features/cart/cartSlice";
import { type Product } from "./ProductPage";
import { Package, Loader2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const OrdersPage: FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { orders, loading } = useSelector((state: RootState) => state.order);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const handleInstantReorder = async (orderId: string, orderItems: any[]) => {
    setReorderingId(orderId);
    try {
      const productIds = orderItems.map(item => item.product_id);
      
      const res = await fetch(`${apiBaseUrl}/products/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: productIds })
      });
      
      if (!res.ok) throw new Error("Failed to fetch product details");
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("Invalid response");
      
      const fullProducts = json.data;
      
      await dispatch(clearCartItems()).unwrap();
      
      const outOfStockItems: any[] = [];
      for (const item of orderItems) {
        const product = fullProducts.find((p: any) => p._id === item.product_id);
        if (product) {
          if (product.stock === 0) {
            outOfStockItems.push(product);
          } else {
            dispatch(optimisticAddItem({ 
              product_id: product._id, 
              quantity: item.quantity, 
              unit_price: product.Price 
            }));
            await dispatch(addItemToCart({ 
              product_id: product._id, 
              quantity: item.quantity 
            })).unwrap();
          }
        }
      }
      navigate("/cart", { state: { outOfStockItems } });
    } catch (err) {
      console.error("Instant reorder failed:", err);
      alert("Failed to instant reorder. Please try again.");
    } finally {
      setReorderingId(null);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchUserOrders());
    }
  }, [isAuthenticated, dispatch]);

  // Fetch product details for items across all orders
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const allProductIds = new Set<string>();
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        if (!productDetails[item.product_id]) {
          allProductIds.add(item.product_id);
        }
      });
    });

    const missingIds = Array.from(allProductIds);
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
  }, [orders, productDetails, apiBaseUrl]);

  if (!isAuthenticated) {
    return (
      <main className="max-w-[1100px] mx-auto p-4 md:py-12 flex flex-col items-center justify-center min-h-[400px] bg-white mt-6 rounded shadow-sm border border-gray-200">
        <Package size={48} className="text-gray-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Please Sign In to view your Orders</h2>
        <button
          onClick={() => navigate("/auth")}
          className="px-8 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition active:scale-[0.98]"
        >
          Sign In Now
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-[1100px] mx-auto p-4 md:py-8 flex flex-col gap-6 font-sans select-none text-[#0f1111] flex-1 w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">Your Orders</h1>
        <button
          onClick={() => navigate("/")}
          className="bg-[#f0f2f2] hover:bg-[#e3e6e6] text-[#0f1111] py-1.5 px-4 rounded-lg text-xs font-semibold cursor-pointer border border-gray-300 shadow-sm transition flex items-center gap-1"
        >
          <ChevronLeft size={14} /> Continue Shopping
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="bg-white p-16 rounded-sm border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-2">
          <Loader2 size={32} className="text-[#e77600] animate-spin" />
          <span className="text-xs text-gray-500 font-medium">Loading your orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-16 rounded-sm border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <Package size={52} className="text-gray-300" />
          <div>
            <h2 className="text-xl font-bold mb-1">No orders yet</h2>
            <p className="text-xs text-gray-500">Looks like you haven't placed any orders. Start shopping now!</p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-semibold rounded-full border border-[#f5c200] cursor-pointer transition"
          >
            Shop Now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {orders.map((order) => {
            const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            const statusColor =
              order.status === "DELIVERED"
                ? "bg-green-100 text-green-800 border-green-300"
                : order.status === "CANCELLED"
                ? "bg-red-100 text-red-800 border-red-300"
                : order.status === "DISPATCHED"
                ? "bg-blue-100 text-blue-800 border-blue-300"
                : "bg-yellow-50 text-yellow-800 border-yellow-300";

            return (
              <div
                key={order._id}
                className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Order Header */}
                <div className="bg-[#f0f2f2] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-gray-200">
                  <div className="flex gap-6 flex-wrap">
                    <div>
                      <span className="text-gray-500 block uppercase font-bold tracking-wide">Order Placed</span>
                      <span className="font-semibold text-[#0f1111]">{orderDate}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block uppercase font-bold tracking-wide">Total</span>
                      <span className="font-semibold text-[#0f1111]">₹{order.grand_total}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-gray-500 uppercase font-bold tracking-wide">Order #</span>
                      <span className="font-semibold text-[#0f1111]">{order.order_id}</span>
                    </div>
                    <button 
                      onClick={() => handleInstantReorder(order._id, order.items)}
                      disabled={reorderingId === order._id}
                      className="flex items-center gap-1.5 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#f5c200] shadow-sm transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {reorderingId === order._id ? (
                        <Loader2 size={14} className="animate-spin text-gray-600" />
                      ) : (
                        <Package size={14} />
                      )}
                      {reorderingId === order._id ? "Reordering..." : "Instant Reorder"}
                    </button>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="px-5 pt-3 pb-1">
                  <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColor} uppercase tracking-wider`}>
                    {order.status}
                  </span>
                </div>

                {/* Order Items */}
                <div className="px-5 pb-4">
                  <div className="flex flex-col divide-y divide-gray-100">
                    {order.items?.map((item) => {
                      const product = productDetails[item.product_id];
                      return (
                        <div key={item.product_id} className="py-3 flex gap-3">
                          <div className="w-[65px] h-[65px] flex items-center justify-center border border-gray-100 p-1 bg-white rounded shrink-0">
                            {product ? (
                              <img
                                src={product.image_small}
                                alt={product.Product}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                                <Loader2 size={12} className="text-gray-400 animate-spin" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4
                              onClick={() => navigate(`/product/${item.product_id}`)}
                              className="text-sm font-semibold leading-tight hover:text-[#007185] cursor-pointer line-clamp-1"
                            >
                              {product ? product.Product : "Loading..."}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>Qty: {item.quantity}</span>
                              <span>₹{item.unit_price} each</span>
                              <span className="font-bold text-[#0f1111]">₹{item.subtotal}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};
