"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, MapPin, Search, AlertCircle, Loader2 } from "lucide-react";
import { inr } from "@/lib/printShop";

// Dynamically import the map component with SSR disabled
const NearbyMap = dynamic(() => import("@/components/printshop/NearbyMap"), { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-gray-100 animate-pulse"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div> });

interface NearbyShop {
  shopCode: string;
  shopName: string;
  locationName: string;
  bwPrice: number;
  colorPrice: number;
  distanceMeters: number;
  latitude?: number; // Not returned directly by DB unless we add it, but we might need it for markers. Wait! The API currently doesn't return lat/lng for markers! Let's update the API to return lat/lng too so the map can plot them.
}

export default function NearbyPrintShops() {
  const [shops, setShops] = useState<NearbyShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [radius, setRadius] = useState(10000); // 10km

  const fetchLocation = () => {
    setLoading(true);
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLoc({ lat: latitude, lng: longitude });
      },
      (err) => {
        let msg = "Failed to detect location";
        if (err.code === err.PERMISSION_DENIED) msg = "Location permission denied. Please allow location access or manually enter a shop code.";
        if (err.code === err.POSITION_UNAVAILABLE) msg = "Location unavailable. Please try again later.";
        if (err.code === err.TIMEOUT) msg = "Location request timed out. Please try again.";
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchNearbyShops = async (lat: number, lng: number, r: number) => {
    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || `${process.env.NEXT_PUBLIC_EXPRESS_URL || "https://share2me-version-2-0.onrender.com"}/g2p/printshop`;
      const res = await fetch(`${API_BASE}/nearby?lat=${lat}&lng=${lng}&radius=${r}`);
      if (!res.ok) throw new Error("Failed to fetch nearby shops");
      const data = await res.json();
      setShops(data.shops || []);
    } catch (err) {
      setError("Failed to load nearby shops.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  useEffect(() => {
    if (userLoc) {
      fetchNearbyShops(userLoc.lat, userLoc.lng, radius);
    }
  }, [userLoc, radius]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] font-sans flex flex-col">
      {/* Header */}
      <header className="h-[70px] bg-white border-b border-[#111827]/10 flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-[#111827]" />
          </Link>
          <div>
            <h1 className="text-[18px] font-bold text-[#111827] leading-tight">Nearby Print Shops</h1>
            <p className="text-[12px] font-medium text-[#111827]/60">Send files to a shop near you</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar List View */}
        <div className="w-full md:w-[400px] lg:w-[450px] bg-white border-r border-[#111827]/10 flex flex-col shrink-0 h-[40vh] md:h-auto z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] order-2 md:order-1">
          <div className="p-5 border-b border-[#111827]/5">
            <h2 className="text-[14px] font-bold text-[#111827] mb-1">Results within {radius / 1000}km</h2>
            <p className="text-[12px] text-[#111827]/60">{loading ? "Searching..." : `Found ${shops.length} shop${shops.length === 1 ? '' : 's'}`}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {loading && !error && (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <Loader2 className="w-8 h-8 text-[#111827] animate-spin mb-3" />
                <p className="text-[13px] font-medium text-[#111827]">Locating nearby shops...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-red-700 mb-4">{error}</p>
                <Link href="/" className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-[12px] font-bold hover:bg-red-50 transition-colors">
                  Enter Shop Code Manually
                </Link>
              </div>
            )}

            {!loading && !error && shops.length === 0 && (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-[14px] font-bold text-[#111827] mb-1">No shops found</h3>
                <p className="text-[12px] text-[#111827]/60 mb-4">There are no print shops within {radius / 1000}km of your location.</p>
                <button
                  onClick={() => setRadius(r => r + 10000)}
                  className="px-4 py-2 rounded-xl bg-[#111827] text-white text-[12px] font-bold hover:bg-black transition-colors"
                >
                  Expand Search Radius (+10km)
                </button>
              </div>
            )}

            {!loading && shops.map(shop => (
              <Link
                key={shop.shopCode}
                href={`/g2p/${shop.shopCode}`}
                className="block bg-white border border-[#111827]/10 rounded-2xl p-4 hover:border-[#111827]/30 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[15px] font-bold text-[#111827] group-hover:text-indigo-600 transition-colors">{shop.shopName}</h3>
                  <span className="inline-flex items-center gap-1 bg-[#111827]/5 px-2 py-1 rounded-md text-[11px] font-bold text-[#111827]/70">
                    <MapPin className="w-3 h-3" /> {formatDistance(shop.distanceMeters)}
                  </span>
                </div>
                {shop.locationName && (
                  <p className="text-[12px] text-[#111827]/60 mb-3">{shop.locationName}</p>
                )}
                <div className="flex items-center gap-4 text-[12px] font-medium text-[#111827]/80 pt-3 border-t border-[#111827]/5">
                  <span>B&W: {inr(shop.bwPrice)}</span>
                  <span>Color: {inr(shop.colorPrice)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Map View */}
        <div className="flex-1 relative order-1 md:order-2 h-[60vh] md:h-auto bg-gray-100">
          <NearbyMap 
            userLoc={userLoc} 
            shops={shops} 
            onExpandRadius={() => setRadius(r => r + 10000)}
          />
        </div>
      </div>
    </div>
  );
}
