import React from "react";
import heroBannerImg from "../assets/amazon_hero.png";

export const HeroSection: React.FC = () => {
  const categories = [
    {
      title: "Health & Personal Care",
      image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=60",
      linkText: "Shop now",
      desc: "Dettol, sanitizers, and more"
    },
    {
      title: "Up to 60% off | Electronics",
      image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=300&auto=format&fit=crop&q=60",
      linkText: "See all deals",
      desc: "Smartphones, watches & laptops"
    },
    {
      title: "Home & Kitchen Essentials",
      image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=300&auto=format&fit=crop&q=60",
      linkText: "Explore kitchenware",
      desc: "Cookware, dining & decor"
    },
    {
      title: "Join Prime Today",
      image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&auto=format&fit=crop&q=60",
      linkText: "Start 30-day free trial",
      desc: "Free fast shipping & video streaming"
    }
  ];

  return (
    <div className="relative bg-[#eaeded] min-h-[600px] pb-10">
      {/* Banner Image Container */}
      <div className="relative w-full overflow-hidden">
        {/* Banner */}
        <img
          src={heroBannerImg}
          alt="Amazon Hero Promotion"
          className="w-full object-cover h-[250px] sm:h-[350px] md:h-[420px] lg:h-[460px] select-none"
        />
        {/* Bottom Fade Gradient Mask */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#eaeded] via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Overlaid Grid Cards */}
      <div className="max-w-[1500px] mx-auto px-4 -mt-16 sm:-mt-32 md:-mt-44 relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {categories.map((cat, idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-sm flex flex-col justify-between shadow-md hover:shadow-lg transition group cursor-pointer duration-300"
          >
            <div>
              <h2 className="text-xl font-bold text-[#0f1111] mb-3 leading-tight tracking-tight">
                {cat.title}
              </h2>
              <div className="h-[200px] w-full overflow-hidden bg-gray-50 flex items-center justify-center rounded-sm">
                <img
                  src={cat.image}
                  alt={cat.title}
                  className="max-h-full max-w-full object-contain group-hover:scale-[1.03] transition duration-300 select-none"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2 font-medium">{cat.desc}</p>
            </div>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-xs text-[#007185] hover:text-[#c45500] hover:underline font-bold mt-4 inline-block transition"
            >
              {cat.linkText}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
