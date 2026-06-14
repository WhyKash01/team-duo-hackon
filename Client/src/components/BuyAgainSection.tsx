import { useEffect, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState, type AppDispatch } from "../app/store";
import { fetchRecommendations } from "../features/recommendations/recommendationSlice";
import { addItemToCart } from "../features/cart/cartSlice";
import { RefreshCw, ShoppingCart, Clock, TrendingUp } from "lucide-react";

export const BuyAgainSection: FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector((state: RootState) => state.recommendations);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchRecommendations());
    }
  }, [isAuthenticated, dispatch]);

  if (!isAuthenticated || (items.length === 0 && !loading)) return null;

  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case "high":
        return {
          dot: "bg-red-500 animate-pulse",
          badge: "bg-red-50 text-red-700 border-red-200",
          label: "Overdue",
        };
      case "medium":
        return {
          dot: "bg-orange-400",
          badge: "bg-orange-50 text-orange-700 border-orange-200",
          label: "Due Soon",
        };
      default:
        return {
          dot: "bg-green-400",
          badge: "bg-green-50 text-green-700 border-green-200",
          label: "Coming Up",
        };
    }
  };

  return (
    <div className="bg-white p-5 rounded-sm shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RefreshCw size={18} className="text-[#e77600]" />
          <h2 className="text-lg md:text-xl font-bold text-[#0f1111]">Buy Again</h2>
          <span className="text-xs text-gray-500 font-medium ml-1">Based on your purchase patterns</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-400">
          <RefreshCw size={16} className="animate-spin" />
          <span>Analyzing your purchase history...</span>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
          {items.map((item) => {
            const urgencyStyle = getUrgencyStyles(item.urgency);
            return (
              <div
                key={item.product_id}
                className="min-w-[200px] max-w-[200px] flex flex-col justify-between border border-gray-100 rounded-sm p-3 hover:shadow-md transition group shrink-0"
              >
                <div>
                  {/* Urgency badge */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-2 h-2 rounded-full ${urgencyStyle.dot}`}></span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${urgencyStyle.badge}`}>
                      {urgencyStyle.label}
                    </span>
                  </div>

                  {/* Product image */}
                  <div className="h-[90px] w-full flex items-center justify-center mb-2">
                    <img
                      src={item.product.image_small}
                      alt={item.product.Product}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Product name */}
                  <h4 className="text-xs font-semibold text-[#0f1111] leading-snug line-clamp-2 min-h-[32px] group-hover:text-[#007185]">
                    {item.product.Product}
                  </h4>

                  {/* Stats */}
                  <div className="flex flex-col gap-0.5 mt-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      Last bought {item.last_purchased_days_ago} days ago
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp size={10} />
                      Usually every {item.avg_interval_days} days
                    </span>
                  </div>
                </div>

                {/* Price + Add to cart */}
                <div className="mt-3 flex flex-col gap-2">
                  <span className="text-sm font-bold text-[#0f1111]">₹{item.product.Price}</span>
                  <button
                    onClick={() =>
                      dispatch(addItemToCart({ product_id: item.product_id, quantity: 1 }))
                    }
                    className="w-full bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#f0b800] text-[#0f1111] py-1.5 rounded-full text-[11px] font-semibold cursor-pointer border border-[#f5c200] transition active:scale-[0.97] flex items-center justify-center gap-1"
                  >
                    <ShoppingCart size={12} /> Add to Cart
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
