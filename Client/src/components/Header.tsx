import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../app/store";
import { logout } from "../features/auth/authSlice";
import { Search, MapPin, ShoppingCart, ChevronDown } from "lucide-react";

interface HeaderProps {
  cartCount?: number;
  onSignInClick?: () => void;
  onRegisterClick?: () => void;
  onLogoClick?: () => void;
  onCartClick?: () => void;
  onReorderClick?: () => void;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  cartCount = 2, 
  onSignInClick,
  onRegisterClick,
  onLogoClick,
  onCartClick,
  onReorderClick,
  onSearch
}) => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [searchCategory, setSearchCategory] = useState("All");
  const [searchInput, setSearchInput] = useState("");

  const handleSearch = () => {
    if (onSearch) {
      onSearch(searchInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleLogout = async () => {
    if (!user) return;
    const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    try {
      await fetch(`${apiBaseUrl}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({ user_id: user.user_id })
      });
    } catch (err) {
      console.error("Failed to notify server of logout:", err);
    }
    dispatch(logout());
  };

  return (
    <header className="bg-[#131921] text-white flex flex-col md:flex-row items-center justify-between px-4 py-2 gap-2 md:gap-4 select-none sticky top-0 z-50">
      {/* Left: Logo & Location */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
        {/* Amazon Logo */}
        <div 
          onClick={onLogoClick}
          className="border border-transparent hover:border-white rounded px-2 py-1 cursor-pointer transition flex items-center"
        >
          <span className="text-xl font-bold tracking-tight text-white flex items-baseline">
            amazon<span className="text-[#febd69] text-sm font-semibold">.in</span>
          </span>
        </div>

        {/* Deliver Address */}
        <div className="border border-transparent hover:border-white rounded px-2 py-1 cursor-pointer transition flex items-center gap-1.5">
          <MapPin size={20} className="text-[#cccccc] self-end mb-1" />
          <div className="flex flex-col text-xs">
            <span className="text-[#cccccc] text-[11px] leading-tight">
              {isAuthenticated && user ? `Deliver to ${user.first_name}` : "Deliver to Yash"}
            </span>
            <span className="font-bold leading-tight">
              {isAuthenticated && user && user.addresses && user.addresses.length > 0 
                ? `${user.addresses[0].city} ${user.addresses[0].zip_code}` 
                : "Bengaluru 560001"}
            </span>
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 text-sm text-black outline-none w-full"
        />

        {/* Search Button */}
        <button 
          onClick={handleSearch}
          className="bg-[#febd69] hover:bg-[#f3a847] text-[#131921] p-2 px-6 flex items-center justify-center cursor-pointer transition"
        >
          <Search size={20} />
        </button>
      </div>

      {/* Right: Lang, Accounts, Orders, Cart */}
      <div className="flex items-center gap-4 text-xs font-bold w-full md:w-auto justify-end">

        {/* Accounts & Lists (With hover menu) */}
        <div className="relative group border border-transparent hover:border-white rounded p-2 cursor-pointer transition flex flex-col text-[13px]">
          <span className="text-[#cccccc] text-[11px] font-normal leading-tight">
            {isAuthenticated && user ? `Hello, ${user.first_name}` : "Hello, Sign in"}
          </span>
          <span className="flex items-center gap-0.5 leading-tight">
            Account & Lists <ChevronDown size={10} className="text-[#ccc] mt-0.5" />
          </span>

          {/* Hover Menu Overlay */}
          <div className="hidden group-hover:block absolute right-0 top-full mt-0.5 bg-white text-black border border-gray-300 shadow-xl rounded-sm p-4 w-60 z-50 text-left cursor-default">
            {!isAuthenticated ? (
              <div className="flex flex-col gap-2.5 items-center">
                <button
                  onClick={onSignInClick}
                  className="w-full bg-[#ffd814] hover:bg-[#f7ca00] border border-[#f5c200] rounded py-1.5 text-center text-xs font-medium cursor-pointer shadow-sm transition active:scale-[0.98]"
                >
                  Sign in
                </button>
                <span className="text-[11px] text-gray-500">
                  New customer?{" "}
                  <button
                    onClick={onRegisterClick}
                    className="text-[#0066c0] hover:underline cursor-pointer font-bold"
                  >
                    Start here.
                  </button>
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-0.5 border-b border-gray-150 pb-2">
                  <span className="font-bold text-xs">Logged in as:</span>
                  <span className="text-gray-600 text-xs truncate font-medium">
                    {user?.first_name} {user?.last_name}
                  </span>
                  <span className="text-gray-400 text-[10px] truncate leading-tight font-normal">
                    {user?.email}
                  </span>
                </div>
                <div className="flex flex-col text-xs font-normal gap-1.5 py-1">
                  <a href="#" className="hover:underline hover:text-[#c45500]">Your Account</a>
                  <a href="#" className="hover:underline hover:text-[#c45500]">Your Orders</a>
                  <a href="#" className="hover:underline hover:text-[#c45500]">Your Wish List</a>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full border border-gray-300 bg-[#f0f2f2] hover:bg-[#e3e6e6] rounded py-1 text-center text-xs font-medium cursor-pointer transition active:scale-[0.98] mt-1.5"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Reorder Button */}
        <div 
          onClick={onReorderClick}
          className="border border-transparent hover:border-white rounded p-2 cursor-pointer transition flex flex-col text-[13px]"
        >
          <span className="text-[#cccccc] text-[11px] font-normal leading-tight">Past Purchases</span>
          <span className="leading-tight">Reorder</span>
        </div>

        {/* Cart */}
        <div 
          onClick={onCartClick}
          className="border border-transparent hover:border-white rounded p-2 cursor-pointer transition flex items-center gap-1 text-[13px]"
        >
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
