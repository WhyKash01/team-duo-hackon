import { useState, useEffect, type FC } from "react";
import { type Product } from "./ProductPage";
import { Settings, Zap, Package, DollarSign, Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const AdminPanel: FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Price update state
  const [priceProductId, setPriceProductId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [priceMsg, setPriceMsg] = useState("");

  // Stock update state
  const [stockProductId, setStockProductId] = useState("");
  const [newStock, setNewStock] = useState("");
  const [stockMsg, setStockMsg] = useState("");

  // Event log
  const [eventLog, setEventLog] = useState<string[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/products?limit=50`);
        const json = await res.json();
        if (json.success) {
          setProducts(json.data || []);
          if (json.data?.length > 0) {
            setPriceProductId(json.data[0]._id);
            setStockProductId(json.data[0]._id);
          }
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [apiBaseUrl]);

  const handleUpdatePrice = async () => {
    if (!priceProductId || !newPrice) return;
    setPriceMsg("");
    try {
      const res = await fetch(`${apiBaseUrl}/admin/update-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: priceProductId, new_price: parseFloat(newPrice) }),
      });
      const json = await res.json();
      if (json.success) {
        const msg = `Price updated: ${priceProductId.slice(-6)} → ₹${newPrice}`;
        setPriceMsg(msg);
        setEventLog((prev) => [msg, ...prev].slice(0, 20));
      } else {
        setPriceMsg("Error: " + (json.error || "Unknown"));
      }
    } catch (err) {
      setPriceMsg("Network error");
    }
  };

  const handleUpdateStock = async () => {
    if (!stockProductId || newStock === "") return;
    setStockMsg("");
    try {
      const res = await fetch(`${apiBaseUrl}/admin/update-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: stockProductId, new_stock: parseInt(newStock) }),
      });
      const json = await res.json();
      if (json.success) {
        const msg = `Stock updated: ${stockProductId.slice(-6)} → ${newStock} units`;
        setStockMsg(msg);
        setEventLog((prev) => [msg, ...prev].slice(0, 20));
      } else {
        setStockMsg("Error: " + (json.error || "Unknown"));
      }
    } catch (err) {
      setStockMsg("Network error");
    }
  };

  return (
    <main className="max-w-[1100px] mx-auto p-4 md:py-8 flex flex-col gap-6 font-sans select-none text-[#0f1111] flex-1 w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Settings size={22} className="text-[#e77600]" />
          <h1 className="text-2xl md:text-3xl font-bold">Admin Panel</h1>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Demo</span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="bg-[#f0f2f2] hover:bg-[#e3e6e6] text-[#0f1111] py-1.5 px-4 rounded-lg text-xs font-semibold cursor-pointer border border-gray-300 shadow-sm transition"
        >
          Back to Store
        </button>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-sm border border-gray-200 flex items-center justify-center gap-2">
          <Loader2 size={24} className="text-[#e77600] animate-spin" />
          <span className="text-sm text-gray-500">Loading products...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Price Update Card */}
          <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <DollarSign size={16} className="text-[#e77600]" />
              Update Product Price
            </h2>
            <p className="text-xs text-gray-500">
              Changes the price and triggers a cart stability event. Users with this item in cart will see a warning.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Product</label>
                <select
                  value={priceProductId}
                  onChange={(e) => setPriceProductId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-xs outline-none focus:border-[#e77600]"
                >
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.Product} (₹{p.Price})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">New Price (₹)</label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="e.g. 65"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#e77600]"
                />
              </div>
              <button
                onClick={handleUpdatePrice}
                className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] py-2 rounded-lg text-xs font-semibold cursor-pointer border border-[#f5c200] transition flex items-center justify-center gap-1.5"
              >
                <Zap size={13} /> Publish Price Change Event
              </button>
              {priceMsg && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                  <CheckCircle size={12} /> {priceMsg}
                </div>
              )}
            </div>
          </div>

          {/* Stock Update Card */}
          <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Package size={16} className="text-[#e77600]" />
              Update Product Stock
            </h2>
            <p className="text-xs text-gray-500">
              Changes stock level and fires a stock event. Set to 0 to simulate out-of-stock.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Product</label>
                <select
                  value={stockProductId}
                  onChange={(e) => setStockProductId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-xs outline-none focus:border-[#e77600]"
                >
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.Product} (stock: {p.stock ?? "?"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">New Stock Count</label>
                <input
                  type="number"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  placeholder="e.g. 3 or 0"
                  min="0"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#e77600]"
                />
              </div>
              <button
                onClick={handleUpdateStock}
                className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] py-2 rounded-lg text-xs font-semibold cursor-pointer border border-[#f5c200] transition flex items-center justify-center gap-1.5"
              >
                <Zap size={13} /> Publish Stock Change Event
              </button>
              {stockMsg && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                  <CheckCircle size={12} /> {stockMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Log */}
      {eventLog.length > 0 && (
        <div className="bg-[#0f1111] rounded-sm p-4 text-xs font-mono text-green-400 max-h-[200px] overflow-y-auto">
          <div className="text-gray-500 mb-2 font-bold uppercase text-[10px]">Event Log</div>
          {eventLog.map((entry, idx) => (
            <div key={idx} className="py-0.5 border-b border-gray-800 last:border-0">
              <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {entry}
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
