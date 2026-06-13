import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "./app/store";
import { addToCartByQty } from "./features/cart/cartSlice";
import { Header } from "./components/Header";
import { SubHeader } from "./components/SubHeader";
import { HeroSection } from "./components/HeroSection";
import { Footer } from "./components/Footer";
import { Star, ShieldCheck, Truck, RotateCcw, Award } from "lucide-react";
import { z } from "zod";

// Zod Schema for Indian pincode validation (6 digits)
const pincodeSchema = z.string().regex(/^\d{6}$/, {
  message: "Pincode must be exactly 6 digits (e.g. 560001)"
});

function App() {
  const dispatch = useDispatch();
  const cartCount = useSelector((state: RootState) => state.cart.count);

  // Buy box state
  const [selectedQty, setSelectedQty] = useState(1);
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

  const handleAddToCart = () => {
    dispatch(addToCartByQty(Number(selectedQty)));
  };

  const productImages = [
    "https://m.media-amazon.com/images/I/61jC8Vq2yAL._SL1500_.jpg", // Main Dettol bottle
    "https://m.media-amazon.com/images/I/61ZoxQ2-pML._SL1500_.jpg", // Back label
    "https://m.media-amazon.com/images/I/61f9wL+1hLL._SL1500_.jpg", // Usage instructions
    "https://m.media-amazon.com/images/I/61fylCskDkL._SL1500_.jpg"  // Safety info
  ];

  const [activeImage, setActiveImage] = useState(productImages[0]);

  return (
    <div className="bg-[#eaeded] min-h-screen font-sans antialiased text-[#0f1111]">
      {/* Header component connected to Redux */}
      <Header cartCount={cartCount} />

      {/* Sub-Header links bar */}
      <SubHeader />

      {/* Hero promo banner */}
      <HeroSection />

      {/* Main product detail container */}
      <main className="max-w-[1500px] mx-auto p-4 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white mt-6 rounded-sm shadow-sm">
        {/* Breadcrumb row */}
        <div className="col-span-12 text-xs text-gray-500 hover:text-gray-700 flex flex-wrap gap-1 items-center pb-2 border-b border-gray-100">
          <a href="#" className="hover:underline">Health & Personal Care</a>
          <span>&gt;</span>
          <a href="#" className="hover:underline">Household Supplies</a>
          <span>&gt;</span>
          <a href="#" className="hover:underline">Household Cleaners</a>
          <span>&gt;</span>
          <a href="#" className="hover:underline text-gray-800 font-medium">Disinfectant Sprays & Liquids</a>
        </div>

        {/* Left Col: Image thumbnails & active display (lg: col-span-5) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-5 flex gap-4">
          {/* Thumbnails */}
          <div className="flex flex-col gap-2.5">
            {productImages.map((img, idx) => (
              <button
                key={idx}
                onMouseEnter={() => setActiveImage(img)}
                onClick={() => setActiveImage(img)}
                className={`w-[45px] h-[55px] border-2 rounded-sm overflow-hidden bg-white p-0.5 flex items-center justify-center cursor-pointer transition ${
                  activeImage === img ? "border-[#e77600] ring-1 ring-[#e77600]" : "border-gray-300 hover:border-[#e77600]"
                }`}
              >
                <img src={img} alt="Dettol thumbnail" className="object-contain max-h-full max-w-full" />
              </button>
            ))}
          </div>

          {/* Active Image display */}
          <div className="flex-1 border border-gray-100 rounded-sm p-4 bg-white flex items-center justify-center h-[350px] md:h-[450px]">
            <img
              src={activeImage}
              alt="Dettol Antiseptic Liquid Main View"
              className="max-h-full max-w-full object-contain transition duration-250 select-none"
            />
          </div>
        </div>

        {/* Center Col: Title, reviews, pricing, and offers (lg: col-span-4) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 flex flex-col gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold leading-tight text-[#0f1111] mb-1">
              Dettol Antiseptic Liquid for First Aid, Surface Disinfection and Personal Hygiene, 1300ml
            </h1>
            <a href="#" className="text-sm text-[#007185] hover:text-[#c45500] hover:underline font-medium">
              Brand: Dettol
            </a>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-orange-500 flex items-center gap-0.5">
              4.6 <Star size={16} className="fill-orange-400 text-orange-400 inline" />
            </span>
            <span className="text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">
              4,357 ratings
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">
              Search this page
            </span>
          </div>

          <div className="text-xs bg-[#f7f7f7] text-[#0f1111] px-2.5 py-1.5 rounded-sm inline-block max-w-max font-bold">
            10K+ bought in past month
          </div>

          <hr className="border-gray-200" />

          {/* Pricing */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-light text-[#0f1111]">₹</span>
              <span className="text-3xl font-medium text-[#0f1111]">537</span>
              <span className="text-2xl font-light text-[#0f1111]">00</span>
              <span className="text-sm text-gray-500 ml-2">
                (₹413.08 / l)
              </span>
            </div>
            <p className="text-xs text-gray-600 font-medium">Inclusive of all taxes</p>
          </div>

          {/* Offers */}
          <div className="border border-gray-200 rounded p-4 flex flex-col gap-3">
            <h4 className="font-bold text-sm text-[#0f1111]">Save Extra with 3 offers</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-[#e77600] rounded-sm p-3 bg-orange-50/20 text-xs">
                <span className="font-bold text-[#e77600] block mb-1">Cashback</span>
                <span className="text-gray-600">Get 5% back with Amazon Pay ICICI Credit Card.</span>
              </div>
              <div className="border border-gray-200 rounded-sm p-3 text-xs">
                <span className="font-bold text-[#0f1111] block mb-1">Bank Offer</span>
                <span className="text-gray-600">10% instant discount up to ₹1,000 on SBI Credit Cards.</span>
              </div>
            </div>
          </div>

          {/* Value Highlights */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] md:text-xs text-[#0f1111] font-semibold py-2">
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]">
                <Truck size={20} />
              </div>
              <span>Free Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]">
                <RotateCcw size={20} />
              </div>
              <span>Non-Returnable</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]">
                <Award size={20} />
              </div>
              <span>Top Brand</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-gray-100 p-2.5 rounded-full text-[#007185]">
                <ShieldCheck size={20} />
              </div>
              <span>Secure transaction</span>
            </div>
          </div>
        </div>

        {/* Right Col: Buy Panel (lg: col-span-3) */}
        <div className="col-span-12 lg:col-span-3 border border-gray-300 rounded p-5 flex flex-col gap-4 shadow-sm bg-white h-fit">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-medium text-[#0f1111]">₹537.00</span>
            <p className="text-xs text-gray-500 font-medium">(₹413.08 / l)</p>
          </div>

          {/* Zod Pincode checking */}
          <form onSubmit={handlePincodeCheck} className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs font-bold text-gray-700">Check delivery availability:</label>
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

          <p className="text-xs text-[#007600] font-bold mt-2">In Stock</p>

          {/* Qty Selector */}
          <div className="flex items-center gap-2 text-sm">
            <span>Quantity:</span>
            <select
              value={selectedQty}
              onChange={(e) => setSelectedQty(Number(e.target.value))}
              className="border border-gray-300 rounded bg-[#f0f2f2] px-2 py-1 text-xs font-medium outline-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

          {/* Buying Buttons */}
          <div className="flex flex-col gap-2.5 mt-2">
            {/* Add to Cart (Redux dispatch) */}
            <button
              onClick={handleAddToCart}
              className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] py-2.5 rounded-full text-xs md:text-sm font-semibold cursor-pointer border border-[#fcd200] transition active:scale-[0.98]"
            >
              Add to Cart
            </button>

            {/* Buy Now */}
            <button
              onClick={() => alert("Proceeding to checkout with " + selectedQty + " items!")}
              className="w-full bg-[#ffa41c] hover:bg-[#fa8900] text-white py-2.5 rounded-full text-xs md:text-sm font-semibold cursor-pointer border border-[#ff9900] transition active:scale-[0.98]"
            >
              Buy Now
            </button>
          </div>

          {/* Buy panel details */}
          <div className="text-xs text-gray-600 flex flex-col gap-1 mt-2">
            <p>
              <span className="text-gray-500">Ships from:</span> RK World Infocom Pvt Ltd
            </p>
            <p>
              <span className="text-gray-500">Sold by:</span> QCom
            </p>
          </div>
        </div>
      </main>

      {/* Spacing spacer to make design feel full and premium */}
      <div className="h-20"></div>

      {/* Footer component */}
      <Footer />
    </div>
  );
}

export default App;
