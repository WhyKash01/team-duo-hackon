import React from "react";
import { Globe, ChevronsUpDown, Zap } from "lucide-react";

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const footerCols = [
    {
      title: "Get to Know Us",
      links: ["About Us", "Careers", "Press Releases", "Amazon Science"]
    },
    {
      title: "Connect with Us",
      links: ["Facebook", "Twitter", "Instagram"]
    },
    {
      title: "Make Money with Us",
      links: [
        "Sell on Amazon",
        "Sell under Amazon Accelerator",
        "Protect and Build Your Brand",
        "Amazon Global Selling",
        "Become an Affiliate",
        "Fulfilment by Amazon",
        "Advertise Your Products"
      ]
    },
    {
      title: "Let Us Help You",
      links: [
        "Your Account",
        "Returns Centre",
        "100% Purchase Protection",
        "Amazon App Download",
        "Help"
      ]
    }
  ];

  const subServices = [
    { name: "AbeBooks", desc: "Books, art & collectibles" },
    { name: "Amazon Web Services", desc: "Scalable Cloud Computing Services" },
    { name: "Audible", desc: "Download Audio Books" },
    { name: "IMDb", desc: "Movies, TV & Celebrities" },
    { name: "Shopbop", desc: "Designer Fashion Brands" },
    { name: "Amazon Business", desc: "Everything For Your Business" },
    { name: "Prime Now", desc: "2-Hour Delivery on Everyday Items" },
    { name: "Amazon Prime Music", desc: "100 million songs, ad-free" }
  ];

  return (
    <footer className="select-none font-sans text-white">
      {/* Back to top */}
      <button
        onClick={scrollToTop}
        className="w-full bg-[#37475a] hover:bg-[#485769] text-center text-xs py-3.5 cursor-pointer font-medium transition duration-200"
      >
        Back to top
      </button>

      {/* Main Directory Links */}
      <div className="bg-[#232f3e] border-b border-[#3a4553] px-6 py-12 md:py-16">
        <div className="max-w-[1000px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-sm">
          {footerCols.map((col, idx) => (
            <div key={idx} className="flex flex-col gap-2.5">
              <h3 className="font-bold text-[#ffffff] text-[15px]">{col.title}</h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="text-[#dddddd] hover:underline text-[13px] hover:text-white transition"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Brand & Language Selectors */}
      <div className="bg-[#232f3e] py-9 flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-16 border-b border-[#131a22] text-xs">
        <div className="border border-transparent px-3 py-1 cursor-pointer">
          <span className="text-xl font-bold tracking-tight text-white flex items-center">
            amazon<span className="text-[#febd69] text-xl font-extrabold italic flex items-center ml-[1px]">Zap<Zap size={18} className="fill-[#febd69] text-[#febd69] ml-[1px]" /></span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language Selector */}
          <div className="border border-[#848688] hover:border-white rounded px-3 py-1.5 flex items-center gap-2 cursor-pointer text-[#ccc] hover:text-white transition">
            <Globe size={14} />
            <span>English</span>
            <ChevronsUpDown size={12} className="text-[#888]" />
          </div>

          {/* Region selector */}
          <div className="border border-[#848688] hover:border-white rounded px-3 py-1.5 flex items-center gap-2 cursor-pointer text-[#ccc] hover:text-white transition">
            <span>🇮🇳 India</span>
          </div>
        </div>
      </div>

      {/* Services grid & Legal Info */}
      <div className="bg-[#131a22] px-6 py-10 text-[11px] text-[#999999]">
        <div className="max-w-[1000px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8 text-center sm:text-left">
          {subServices.map((service, idx) => (
            <a
              key={idx}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="hover:underline flex flex-col group"
            >
              <span className="font-bold text-white text-[11px] group-hover:underline">
                {service.name}
              </span>
              <span className="text-[#999999] leading-tight mt-0.5">
                {service.desc}
              </span>
            </a>
          ))}
        </div>

        {/* Legal links and copyright */}
        <div className="flex flex-col items-center gap-2 text-center text-xs">
          <div className="flex items-center gap-3">
            <a href="#" onClick={(e) => e.preventDefault()} className="hover:underline hover:text-white">
              Conditions of Use & Sale
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} className="hover:underline hover:text-white">
              Privacy Notice
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} className="hover:underline hover:text-white">
              Interest-Based Ads
            </a>
          </div>
          <span className="text-[#999999] text-[11px] mt-1">
            © 1996-2026, Amazon.com, Inc. or its affiliates
          </span>
        </div>
      </div>
    </footer>
  );
};
