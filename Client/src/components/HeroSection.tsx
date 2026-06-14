import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, Mic, MicOff, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { addFavCategory, removeFavCategory, optimisticAddFavCategory, optimisticRemoveFavCategory } from "../features/favCategory/favCategorySlice";

export const HeroSection: React.FC = () => {
  const [task, setTask] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const favCategories = useSelector((state: RootState) => state.favCategory.categories);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sampleCategories = [
    { category: "Water & Beverages" },
    { category: "Dairy, Bakery & Eggs" },
    { category: "Chicken, Meat & Fish" },
    { category: "Fruits & Vegetables" },
    { category: "Food Cupboard" },
    { category: "Snacks & Sweets" },
    { category: "Baby Essentials" },
    { category: "Pet" }
  ];
  const [categories, setCategories] = useState<any[]>(sampleCategories);

  useEffect(() => {
    const fetchCategories = async () => {
      const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
      try {
        const res = await fetch(`${apiBaseUrl}/categories/top`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && json.data.length > 0) {
            setCategories(json.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch top categories:", err);
      }
    };
    fetchCategories();
  }, []);

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task.trim()) {
      navigate(`/task-shopping?task=${encodeURIComponent(task.trim())}`);
    }
  };

  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported. Try Chrome or Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setTask(transcript);
    };

    recognition.onspeechend = () => {
      recognition.stop();
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow microphone in browser settings.");
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      setIsListening(false);
    }
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const slide = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 500;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="bg-white">
      {/* Task-Oriented Shopping — Gradient Banner */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 30%, #40916c 60%, #52b788 100%)' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 w-32 h-32 rounded-full bg-white/20 blur-2xl"></div>
          <div className="absolute bottom-4 right-12 w-48 h-48 rounded-full bg-white/15 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
        </div>
        <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12 relative z-10">
          <div className="flex items-center gap-2.5 mb-3">
            <Sparkles className="text-[#ffd814]" size={24} />
            <h2 className="text-white text-xl md:text-2xl font-bold tracking-tight">
              Task-Oriented Shopping
            </h2>
          </div>
          <p className="text-white/80 mb-5 text-sm md:text-base max-w-xl">
            Tell us what you want to do — our AI builds your shopping list instantly!
          </p>
          <form onSubmit={handleTaskSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-2xl">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder={isListening ? "🎤 Listening... speak now" : "e.g. I want to cook spaghetti carbonara"}
                data-task-input
                className={`w-full pl-10 pr-12 py-3 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-[#ffd814] text-sm ${
                  isListening ? "border-2 border-red-400 bg-red-50" : "border-0 bg-white"
                }`}
              />
              <button
                type="button"
                onClick={isListening ? stopVoice : startVoice}
                className={`absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer transition ${
                  isListening ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-[#2d6a4f]"
                }`}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={!task.trim()}
              className="bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] px-6 py-3 rounded-lg font-bold shadow-lg transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
            >
              Build My List
            </button>
          </form>
        </div>
      </div>


      {/* Category Slider */}
      <div className="border-b border-gray-100">
        <div className="max-w-[1500px] mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#0f1111]">Shop by Category</h3>
          </div>
          <div className="relative group">
            {/* Left Arrow */}
            <button
              onClick={() => slide('left')}
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 bg-white text-gray-600 hover:text-gray-900 w-10 h-10 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-gray-200"
            >
              <ChevronLeft size={20} />
            </button>

            <div
              ref={scrollContainerRef}
              className="overflow-x-auto scrollbar-hide flex gap-3 scroll-smooth"
            >
              {categories.map((cat, idx) => {
                const isFav = favCategories.includes(cat.category);
                
                const handleToggleFav = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!isAuthenticated) {
                    navigate("/auth");
                    return;
                  }
                  if (isFav) {
                    dispatch(optimisticRemoveFavCategory(cat.category));
                    dispatch(removeFavCategory(cat.category));
                  } else {
                    dispatch(optimisticAddFavCategory(cat.category));
                    dispatch(addFavCategory(cat.category));
                  }
                };

                return (
                  <div
                    key={idx}
                    onClick={() => navigate(`/search?category=${encodeURIComponent(cat.category)}`)}
                    className="shrink-0 w-[120px] cursor-pointer group/card flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#f7faf7] transition-colors duration-200 relative"
                  >
                    <button
                      onClick={handleToggleFav}
                      className={`absolute top-1 right-1 z-10 p-1.5 rounded-full shadow-sm border transition-colors ${
                        isFav 
                          ? "bg-red-50 border-red-100 text-red-500" 
                          : "bg-white/90 border-gray-100 text-gray-300 hover:text-red-400 hover:bg-white"
                      }`}
                      title={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart size={16} fill={isFav ? "currentColor" : "none"} />
                    </button>
                    <div className="w-[80px] h-[80px] rounded-full overflow-hidden bg-[#f0f7f0] border-2 border-[#e8f5e9] group-hover/card:border-[#49a353] transition-colors duration-200 shadow-sm relative">
                      <img
                        src={cat.image || `https://picsum.photos/seed/${encodeURIComponent(cat.category)}/200/200`}
                        alt={cat.category}
                        className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#0f1111] text-center leading-tight group-hover/card:text-[#2d6a4f] transition-colors duration-200 line-clamp-2">
                      {cat.category}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => slide('right')}
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 bg-white text-gray-600 hover:text-gray-900 w-10 h-10 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-gray-200"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
