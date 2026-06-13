import React, { useState } from "react";
import { Search, MapPin, ShoppingCart, ChevronDown } from "lucide-react";

interface HeaderProps {
  cartCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ cartCount = 2 }) => {
  const [searchCategory, setSearchCategory] = useState("All");

  return (
    <header className="bg-[#131921] text-white flex flex-col md:flex-row items-center justify-between px-4 py-2 gap-2 md:gap-4 select-none sticky top-0 z-50">
      {/* Left: Logo & Location */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
        {/* Amazon Logo */}
        <div className="border border-transparent hover:border-white rounded px-2 py-1 cursor-pointer transition flex items-center">
          <span className="text-xl font-bold tracking-tight text-white flex items-baseline">
            amazon<span className="text-[#febd69] text-sm font-semibold">.in</span>
          </span>
        </div>

        {/* Deliver Address */}
        <div className="border border-transparent hover:border-white rounded px-2 py-1 cursor-pointer transition flex items-center gap-1.5">
          <MapPin size={20} className="text-[#cccccc] self-end mb-1" />
          <div className="flex flex-col text-xs">
            <span className="text-[#cccccc] text-[11px] leading-tight">Deliver to Yash</span>
            <span className="font-bold leading-tight">Bengaluru 560001</span>
          </div>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex flex-1 items-center bg-white rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#f3a847] w-full max-w-4xl">
        {/* Category Dropdown */}
        <div className="relative group bg-[#f3f3f3] hover:bg-[#dadada] text-[#555] text-xs font-medium px-3 py-2.5 flex items-center gap-1 cursor-pointer border-r border-[#ccc] transition">
          <span>{searchCategory}</span>
          <ChevronDown size={12} />
          <select 
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Deals">Deals</option>
            <option value="Electronics">Electronics</option>
            <option value="Fashion">Fashion</option>
            <option value="Home">Home & Kitchen</option>
            <option value="Health">Health & Personal Care</option>
          </select>
        </div>

        {/* Input */}
        <input
          type="text"
          placeholder="Search Amazon.in"
          className="flex-1 px-3 py-2 text-sm text-black outline-none w-full"
        />

        {/* Search Button */}
        <button className="bg-[#febd69] hover:bg-[#f3a847] text-[#131921] p-2 px-6 flex items-center justify-center cursor-pointer transition">
          <Search size={20} />
        </button>
      </div>

      {/* Right: Lang, Accounts, Orders, Cart */}
      <div className="flex items-center gap-4 text-xs font-bold w-full md:w-auto justify-end">
        {/* Language Select */}
        <div className="border border-transparent hover:border-white rounded p-2 cursor-pointer transition flex items-center gap-1">
          <span className="text-base">🇮🇳</span>
          <span className="uppercase text-[13px] tracking-wide">EN</span>
          <ChevronDown size={10} className="text-[#ccc] mt-0.5" />
        </div>

        {/* Accounts & Lists */}
        <div className="border border-transparent hover:border-white rounded p-2 cursor-pointer transition flex flex-col text-[13px]">
          <span className="text-[#cccccc] text-[11px] font-normal leading-tight">Hello, Yash</span>
          <span className="flex items-center gap-0.5 leading-tight">
            Account & Lists <ChevronDown size={10} className="text-[#ccc] mt-0.5" />
          </span>
        </div>

        {/* Returns & Orders */}
        <div className="border border-transparent hover:border-white rounded p-2 cursor-pointer transition flex flex-col text-[13px]">
          <span className="text-[#cccccc] text-[11px] font-normal leading-tight">Returns</span>
          <span className="leading-tight">& Orders</span>
        </div>

        {/* Cart */}
        <div className="border border-transparent hover:border-white rounded p-2 cursor-pointer transition flex items-center gap-1 text-[13px]">
          <div className="relative">
            <ShoppingCart size={26} className="text-white" />
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-[#131921] text-[#f08804] text-sm font-bold px-1 rounded-full leading-none">
              {cartCount}
            </span>
          </div>
          <span className="self-end font-bold text-sm hidden sm:inline">Cart</span>
        </div>
      </div>
    </header>
  );
};
