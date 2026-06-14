import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import heroBannerImg from "../assets/amazon_hero.png";
import { Search, Sparkles } from "lucide-react";

export const HeroSection: React.FC = () => {
  const [task, setTask] = useState("");
  const navigate = useNavigate();

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task.trim()) {
      navigate(`/task-shopping?task=${encodeURIComponent(task.trim())}`);
    }
  };

  return (
    <div className="relative bg-[#eaeded] min-h-[500px] pb-10">
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

      {/* Task-Oriented Shopping Block Overlaid */}
      <div className="max-w-[800px] mx-auto px-4 -mt-20 sm:-mt-32 md:-mt-44 relative z-10">
        <div className="bg-white p-6 md:p-10 rounded-lg shadow-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-4 text-[#0f1111]">
            <Sparkles className="text-[#e77600]" size={28} />
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Task-Oriented Shopping
            </h2>
          </div>
          <p className="text-gray-600 mb-6 font-medium text-sm md:text-base">
            Tell us what you want to do (e.g., "I want to cook spaghetti carbonara" or "I need to clean the bathroom"), and our AI will instantly build your shopping list!
          </p>
          <form onSubmit={handleTaskSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={20} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="What do you want to accomplish today?"
                className="w-full pl-11 pr-4 py-3 md:py-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#f5c200] focus:border-[#f5c200] text-base"
              />
            </div>
            <button
              type="submit"
              disabled={!task.trim()}
              className="bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] px-8 py-3 md:py-4 rounded-md font-bold shadow-sm border border-[#f5c200] transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Build My List
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
