import { useState, useEffect, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { addItemToCart, optimisticAddItem } from "../features/cart/cartSlice";
import { Star, ShieldCheck, Truck, RotateCcw, Award, ChevronLeft, ShoppingCart } from "lucide-react";
import { z } from "zod";

// Zod Schema for Indian pincode validation (6 digits)
const pincodeSchema = z.string().regex(/^\d{6}$/, {
  message: "Pincode must be exactly 6 digits (e.g. 560001)"
});

export interface Product {
  _id: string;
  Brand: string;
  Product: string;
  Quantity: string;
  Price: number;
  MRP: number;
  Category?: string;
  "Sub-Category"?: string;
  image_small: string;
  stock?: number;
  id?: number;
}

interface ProductPageProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (qty: number) => void;
  initialQty?: number;
}

export const ProductPage: FC<ProductPageProps> = ({ 
  product, 
  onBack, 
  onAddToCart,
  initialQty = 1
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Scroll to top when the product changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [product._id]);

  interface SubstituteProduct {
    _id?: { $oid: string };
    id: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    match_score: number;
  }

  const [substitutes, setSubstitutes] = useState<SubstituteProduct[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [substituteDetails, setSubstituteDetails] = useState<Record<string, Product>>({});

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  // Fetch similar products / substitutes from the ML Engine route
  useEffect(() => {
    if (!product._id) return;
    const fetchSubstitutes = async () => {
      setLoadingSubs(true);
      try {
        const res = await fetch(`${apiBaseUrl}/products/${product._id}/substitutes`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setSubstitutes(json.data || []);
          }
        }
      } catch (err) {
        console.error("Error fetching substitutes:", err);
      } finally {
        setLoadingSubs(false);
      }
    };
    fetchSubstitutes();
  }, [product._id, apiBaseUrl]);

  // Batch fetch full product details for each substitute
  useEffect(() => {
    if (substitutes.length === 0) return;
    const fetchAllDetails = async () => {
      const details: Record<string, Product> = {};
      await Promise.all(
        substitutes.map(async (sub) => {
          const subId = sub._id?.$oid || sub.id;
          try {
            const res = await fetch(`${apiBaseUrl}/products/${subId}`);
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                details[subId] = json.data;
              }
            }
          } catch (err) {
            console.error(`Error fetching detail for substitute ${subId}:`, err);
          }
        })
      );
      setSubstituteDetails((prev) => ({ ...prev, ...details }));
    };
    fetchAllDetails();
  }, [substitutes, apiBaseUrl]);

  const [selectedQty, setSelectedQty] = useState(initialQty);

  useEffect(() => {
    setSelectedQty(initialQty);
  }, [initialQty]);
  const [pincode, setPincode] = useState("");
  const [pincodeError, setPincodeError] = useState("");
  const [pincodeSuccess, setPincodeSuccess] = useState("");

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    setPincodeError("");
    setPincodeSuccess("");

    const result = pincodeSchema.safeParse(pincode);
    if (!result.success) {
      setPincodeError(result.error.issues[0].message);
    } else {
      setPincodeSuccess(`Fast delivery available to ${pincode}!`);
    }
  };

  const handleAddToCartClick = () => {
    onAddToCart(selectedQty);
  };

  // Helper to generate stars and count dynamically for catalog looks
  const getRandomRating = (productId: string) => {
    const code = productId.charCodeAt(productId.length - 1) || 5;
    const rating = 4.0 + (code % 10) * 0.1;
    const reviews = 50 + (code * 17) % 500;
    return { rating: rating.toFixed(1), reviews };
  };

  const hasDiscount = product.MRP > product.Price;
  const discountPct = hasDiscount ? Math.round(((product.MRP - product.Price) / product.MRP) * 100) : 0;

  return (
    <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-6 flex-1 px-4 md:px-0">
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-4 md:py-8 mt-6 rounded-sm shadow-sm font-sans select-none text-[#0f1111] w-full">
        {/* Breadcrumb row */}
        <div className="col-span-12 text-xs text-gray-500 hover:text-gray-700 flex flex-wrap gap-1.5 items-center pb-2 border-b border-gray-100 justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button 
              onClick={onBack} 
              className="hover:underline text-[#007185] font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <ChevronLeft size={14} /> Back to products
            </button>
            <span>/</span>
            <span className="capitalize">{product.Category || "Grocery"}</span>
            {product["Sub-Category"] && (
              <>
                <span>/</span>
                <span className="capitalize text-gray-800 font-medium">{product["Sub-Category"]}</span>
              </>
            )}
          </div>
        </div>

        {/* Left Col: Product Image */}
        <div className="col-span-12 md:col-span-6 lg:col-span-5 flex items-center justify-center border border-gray-100 rounded-sm p-8 bg-white h-[350px] md:h-[450px]">
          <img
            src={product.image_small}
            alt={product.Product}
            className="max-h-full max-w-full object-contain transition duration-200"
          />
        </div>

        {/* Center Col: Title, Pricing, & Badges */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 flex flex-col gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold leading-tight text-[#0f1111] mb-1">
              {product.Product}
            </h1>
            <span className="text-sm text-[#007185] font-medium block">
              Brand: {product.Brand}
            </span>
            <span className="text-xs text-gray-500 mt-1 block">
              Pack Size: {product.Quantity}
            </span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-orange-500 flex items-center gap-0.5">
              {getRandomRating(product._id).rating} <Star size={16} className="fill-orange-400 text-orange-400 inline" />
            </span>
            <span className="text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">
              {getRandomRating(product._id).reviews} ratings
            </span>
          </div>

          <hr className="border-gray-200" />

          {/* Pricing */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-light text-[#0f1111]">₹</span>
              <span className="text-3xl font-medium text-[#0f1111]">{product.Price}</span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-gray-500 line-through ml-2">
                    MRP: ₹{product.MRP}
                  </span>
                  <span className="text-sm text-green-700 font-bold ml-2">
                    ({discountPct}% Off)
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-600 font-medium">Inclusive of all taxes</p>
          </div>

          {/* Offers */}
          <div className="border border-gray-200 rounded p-4 flex flex-col gap-3">
            <h4 className="font-bold text-sm text-[#0f1111]">Offers available</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="border border-orange-300 rounded p-2.5 bg-orange-50/10">
                <span className="font-bold text-[#e77600] block mb-1">Cashback</span>
                <span className="text-gray-600">Get 5% back with Amazon Pay ICICI Credit Card.</span>
              </div>
              <div className="border border-gray-200 rounded p-2.5">
                <span className="font-bold text-[#0f1111] block mb-1">Bank Offer</span>
                <span className="text-gray-600">Flat 10% discount on credit card transactions.</span>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] md:text-xs text-[#0f1111] font-semibold py-2">
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]"><Truck size={20} /></div>
              <span>Free Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]"><RotateCcw size={20} /></div>
              <span>Non-Returnable</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]"><Award size={20} /></div>
              <span>Top Brand</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]"><ShieldCheck size={20} /></div>
              <span>Secure check</span>
            </div>
          </div>
        </div>

        {/* Right Col: Buy Panel */}
        <div className="col-span-12 lg:col-span-3 border border-gray-300 rounded p-5 flex flex-col gap-4 shadow-sm bg-white h-fit">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-medium text-[#0f1111]">₹{product.Price}</span>
            <p className="text-xs text-gray-500 font-medium">Quantity: {product.Quantity}</p>
          </div>

          {/* Pincode checking */}
          <form onSubmit={handlePincodeCheck} className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs font-bold text-gray-700">Check availability:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Enter 6-digit Pincode"
                className="border border-gray-300 rounded px-2.5 py-1 text-sm outline-none focus:border-[#e77600] flex-1 min-w-0"
              />
              <button
                type="submit"
                className="bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-3 py-1 text-xs font-medium cursor-pointer transition"
              >
                Check
              </button>
            </div>
            {pincodeError && <p className="text-xs text-red-600 font-semibold mt-0.5">{pincodeError}</p>}
            {pincodeSuccess && <p className="text-xs text-green-600 font-semibold mt-0.5">{pincodeSuccess}</p>}
          </form>

          {/* Stock Status */}
          {product.stock === 0 ? (
            <p className="text-xs text-red-600 font-bold mt-2">Currently Unavailable</p>
          ) : product.stock !== undefined && product.stock <= 5 ? (
            <p className="text-xs text-orange-600 font-bold mt-2">Only {product.stock} left in stock — order soon</p>
          ) : (
            <p className="text-xs text-[#007600] font-bold mt-2">In Stock</p>
          )}

          {/* Qty Selector */}
          <div className="flex items-center gap-2 text-sm">
            <span>Qty:</span>
            <select
              value={selectedQty}
              onChange={(e) => setSelectedQty(Number(e.target.value))}
              disabled={product.stock === 0}
              className="border border-gray-300 rounded bg-[#f0f2f2] px-2 py-1 text-xs font-medium outline-none cursor-pointer disabled:opacity-50"
            >
              {Array.from({ length: Math.min(6, product.stock ?? 6) }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 mt-2">
            <button
              onClick={handleAddToCartClick}
              disabled={product.stock === 0}
              className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] py-2.5 rounded-full text-xs md:text-sm font-semibold cursor-pointer border border-[#fcd200] transition active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed"
            >
              {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
            </button>
            <button
              onClick={() => navigate("/cart")}
              className="w-full bg-[#ffa41c] hover:bg-[#fa8900] text-white py-2.5 rounded-full text-xs md:text-sm font-semibold cursor-pointer border border-[#ff9900] transition active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ShoppingCart size={15} /> Go to Cart
            </button>
          </div>

          <div className="text-xs text-gray-600 flex flex-col gap-1 mt-2">
            <p><span className="text-gray-500">Ships from:</span> SuperCom Net</p>
            <p><span className="text-gray-500">Sold by:</span> iD Fresh Private Ltd</p>
          </div>
        </div>
      </main>

      {/* Similar Products & Substitutes Section */}
      {(loadingSubs || substitutes.length > 0) && (
        <section className="bg-white p-6 rounded-sm shadow-sm border border-gray-200 mb-8 animate-in fade-in duration-300">
          <div className="border-b border-gray-100 pb-3 mb-5">
            <h2 className="text-lg md:text-xl font-bold text-[#0f1111] flex items-center gap-2">
              ✨ Similar Products & Smart Alternatives
            </h2>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              We found the closest matching alternatives using real-time semantic search.
            </p>
          </div>

          {loadingSubs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="border border-gray-150 p-4 rounded-sm animate-pulse flex flex-col gap-3">
                  <div className="h-[120px] bg-gray-100 rounded-sm"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
              {substitutes.map((sub) => {
                const subId = sub._id?.$oid || sub.id;
                const detail = substituteDetails[subId];
                const image = detail?.image_small || (subId === "6a2e5e93cac35b4b62e274cf" ? "https://www.bigbasket.com/media/uploads/p/s/40214336_2-happychef-thai-red-curry-kit.jpg" : "https://via.placeholder.com/150?text=No+Image");
                const isMatchHigh = sub.match_score >= 80;

                return (
                  <div
                    key={subId}
                    onClick={() => {
                      navigate(`/product/${subId}`);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="bg-white p-4 rounded-sm flex flex-col justify-between shadow-sm hover:shadow-md transition duration-200 group cursor-pointer border border-gray-100 hover:border-gray-300"
                  >
                    <div>
                      {/* Image container */}
                      <div className="h-[120px] w-full flex items-center justify-center overflow-hidden mb-3 bg-white p-1 rounded-sm relative">
                        <img
                          src={image}
                          alt={sub.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-[1.03] transition duration-200 select-none"
                        />
                        <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm text-white ${isMatchHigh ? "bg-green-600" : "bg-blue-600"}`}>
                          {sub.match_score}% Match
                        </span>
                      </div>

                      {/* Brand & Name */}
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5 tracking-wide uppercase truncate">
                        {sub.brand}
                      </span>
                      <h3 className="text-xs md:text-sm text-[#0f1111] font-semibold leading-snug group-hover:text-[#007185] line-clamp-2 mb-1 min-h-[36px]">
                        {sub.name}
                      </h3>

                      {/* Category */}
                      <span className="text-[10px] text-gray-500 font-medium block mb-2 truncate capitalize">
                        {sub.category}
                      </span>
                    </div>

                    {/* Price and Action */}
                    <div className="mt-2 flex flex-col gap-2">
                      <span className="text-sm md:text-base font-bold text-gray-900">₹{sub.price}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isAuthenticated) {
                            navigate("/auth");
                          } else {
                            dispatch(optimisticAddItem({ product_id: subId, quantity: 1, unit_price: sub.price }));
                            dispatch(addItemToCart({ product_id: subId, quantity: 1 }));
                          }
                        }}
                        className="w-full bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#f0b800] text-[#0f1111] py-1.5 rounded-full text-[10px] font-bold cursor-pointer border border-[#f5c200] transition active:scale-[0.97]"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
