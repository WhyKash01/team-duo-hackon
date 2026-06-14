import { useState, useEffect, useRef, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type AppDispatch, type RootState } from "../app/store";
import { fetchCart } from "../features/cart/cartSlice";
import { fetchCartStatus } from "../features/cart/cartStabilitySlice";
import { fetchRecommendations } from "../features/recommendations/recommendationSlice";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

export const NetworkStatusBanner: FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setShowReconnected(true);
        wasOfflineRef.current = false;

        // Sync data after reconnection
        if (isAuthenticated) {
          setSyncing(true);
          Promise.all([
            dispatch(fetchCart()),
            dispatch(fetchCartStatus()),
            dispatch(fetchRecommendations()),
          ]).finally(() => {
            setSyncing(false);
            setTimeout(() => setShowReconnected(false), 4000);
          });
        } else {
          setTimeout(() => setShowReconnected(false), 3000);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isAuthenticated, dispatch]);

  if (!isOnline) {
    return (
      <div className="bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-2 py-2 px-4 animate-in fade-in duration-200 z-[100]">
        <WifiOff size={14} />
        <span>You're offline. Cart changes will sync when you reconnect.</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="bg-green-600 text-white text-xs font-semibold flex items-center justify-center gap-2 py-2 px-4 animate-in fade-in duration-200 z-[100]">
        {syncing ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            <span>Back online — syncing your cart and data...</span>
          </>
        ) : (
          <>
            <Wifi size={14} />
            <span>Back online — everything synced!</span>
          </>
        )}
      </div>
    );
  }

  return null;
};
