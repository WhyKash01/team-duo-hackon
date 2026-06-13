import React from "react";
import { Menu } from "lucide-react";

export const SubHeader: React.FC = () => {
  const links = [
    { label: "Rufus", highlight: true },
    { label: "Fresh" },
    { label: "MX Player" },
    { label: "Sell" },
    { label: "Gift Cards" },
    { label: "Amazon Pay" },
    { label: "Gift Ideas" },
    { label: "Buy Again" },
    { label: "AmazonBasics" },
    { label: "Prime", hasDropdown: true },
    { label: "Health, Household & Personal Care" },
    { label: "Home Improvement" },
    { label: "Audible" }
  ];

  return (
    <nav className="bg-[#232f3e] text-white text-[13px] font-medium flex items-center px-4 py-1.5 overflow-x-auto whitespace-nowrap scrollbar-none gap-3 border-b border-[#131921] select-none">
      {/* Menu / All Button */}
      <div className="flex items-center gap-1.5 border border-transparent hover:border-white rounded px-2 py-1 cursor-pointer transition">
        <Menu size={16} />
        <span className="font-bold">All</span>
      </div>

      {/* Nav Links */}
      <div className="flex items-center gap-1.5 flex-1">
        {links.map((link, idx) => (
          <div
            key={idx}
            className={`border border-transparent hover:border-white rounded px-2 py-1 cursor-pointer transition flex items-center gap-0.5 ${
              link.highlight ? "text-[#febd69] font-bold" : ""
            }`}
          >
            <span>{link.label}</span>
            {link.hasDropdown && (
              <span className="border-t-4 border-x-4 border-transparent border-t-[#ccc] mt-1.5 ml-0.5"></span>
            )}
          </div>
        ))}
      </div>

      {/* Right Side: Promotion */}
      <div className="hidden lg:block border border-transparent hover:border-white rounded px-2 py-1 cursor-pointer transition text-right font-bold text-xs text-[#febd69]">
        Shop Groceries & More on Amazon Now
      </div>
    </nav>
  );
};
