import { type FC } from "react";
import { useDispatch } from "react-redux";
import { type AppDispatch } from "../app/store";
import { clearStaleItem, type StaleItem } from "../features/cart/cartStabilitySlice";
import { AlertTriangle, XCircle, AlertCircle } from "lucide-react";

interface Props {
  staleItem: StaleItem;
}

export const CartStabilityBanner: FC<Props> = ({ staleItem }) => {
  const dispatch = useDispatch<AppDispatch>();

  if (staleItem.type === "price_changed") {
    return (
      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs animate-in fade-in duration-300">
        <AlertTriangle size={14} className="text-yellow-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-bold text-yellow-800">Price Updated</span>
          <p className="text-yellow-700 mt-0.5">
            ₹{staleItem.old_price} → <span className="font-bold">₹{staleItem.new_price}</span>
          </p>
        </div>
        <button
          onClick={() => dispatch(clearStaleItem(staleItem.product_id))}
          className="text-yellow-600 hover:text-yellow-800 cursor-pointer"
          title="Dismiss"
        >
          <XCircle size={14} />
        </button>
      </div>
    );
  }

  if (staleItem.type === "low_stock") {
    return (
      <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded px-3 py-2 text-xs animate-in fade-in duration-300">
        <AlertCircle size={14} className="text-orange-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-bold text-orange-800">Low Stock</span>
          <p className="text-orange-700 mt-0.5">
            Only <span className="font-bold">{staleItem.available}</span> left in stock
          </p>
        </div>
        <button
          onClick={() => dispatch(clearStaleItem(staleItem.product_id))}
          className="text-orange-600 hover:text-orange-800 cursor-pointer"
          title="Dismiss"
        >
          <XCircle size={14} />
        </button>
      </div>
    );
  }

  if (staleItem.type === "out_of_stock") {
    return (
      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs animate-in fade-in duration-300">
        <XCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-bold text-red-800">Out of Stock</span>
          <p className="text-red-700 mt-0.5">This item is currently unavailable</p>
        </div>
        <button
          onClick={() => dispatch(clearStaleItem(staleItem.product_id))}
          className="text-red-600 hover:text-red-800 cursor-pointer"
          title="Dismiss"
        >
          <XCircle size={14} />
        </button>
      </div>
    );
  }

  return null;
};
