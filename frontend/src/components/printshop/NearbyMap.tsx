"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Store, Navigation2, CheckCircle2 } from "lucide-react";
import { renderToString } from "react-dom/server";
import { inr } from "@/lib/printShop";

// Fix default marker icon URLs once at module load, not on every mount.
// Mutating a shared prototype inside a component effect re-runs this
// pointlessly on every (re)mount and is a common source of subtle bugs
// once other Leaflet components share the page.
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

// ─── Custom Icons ─────────────────────────────────────────────────────────────
let userIconCache: L.DivIcon | null = null;
const createUserIcon = () => {
  if (userIconCache) return userIconCache;
  const html = renderToString(
    <div className="relative flex items-center justify-center w-10 h-10">
      <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-40"></div>
      <div className="relative bg-blue-600 rounded-full w-4 h-4 border-2 border-white shadow-sm flex items-center justify-center z-10">
      </div>
    </div>
  );
  userIconCache = L.divIcon({ html, className: "custom-user-icon", iconSize: [40, 40], iconAnchor: [20, 20] });
  return userIconCache;
};

// Cache shop icons by price label so identical prices reuse the same
// L.divIcon instead of re-rendering markup and constructing a new icon
// object on every render pass.
const shopIconCache = new Map<string, L.DivIcon>();
const createShopIcon = (price: string) => {
  const cached = shopIconCache.get(price);
  if (cached) return cached;
  const html = renderToString(
    <div className="relative">
      <div className="bg-[#111827] text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 border border-white/20 whitespace-nowrap relative z-10">
        <Store className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-bold text-[13px] leading-none">{price}</span>
      </div>
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#111827] rotate-45 z-0"></div>
    </div>
  );
  const icon = L.divIcon({ html, className: "custom-shop-icon", iconSize: [80, 40], iconAnchor: [40, 40] });
  shopIconCache.set(price, icon);
  return icon;
};

// ─── Component ────────────────────────────────────────────────────────────────

function AddressResolver({ initialName, lat, lng }: { initialName?: string, lat: number, lng: number }) {
  const [address, setAddress] = useState(initialName || "Fetching location...");
  
  useEffect(() => {
    if (initialName) return;
    let isMounted = true;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data && data.display_name) {
          setAddress(data.display_name);
        } else if (isMounted) {
          setAddress("Coordinates available");
        }
      })
      .catch(() => {
        if (isMounted) setAddress("Coordinates available");
      });
      
    return () => { isMounted = false; };
  }, [initialName, lat, lng]);

  return <p className="text-[11px] text-[#111827]/60 mb-3 line-clamp-2 leading-relaxed" title={address}>{address}</p>;
}

function MapViewController({ userLoc, shops }: { userLoc: { lat: number, lng: number } | null, shops: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (userLoc) {
      map.flyTo([userLoc.lat, userLoc.lng], 13, { animate: true, duration: 1.5 });
    }
  }, [userLoc, shops, map]);
  return null;
}

export default function NearbyMap({ userLoc, shops, onExpandRadius }: { userLoc: { lat: number, lng: number } | null, shops: any[], onExpandRadius: () => void }) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const mapConfig = useMemo(
    () => ({
      center: (userLoc ? [userLoc.lat, userLoc.lng] : [20.5937, 78.9629]) as [number, number],
      zoom: userLoc ? 13 : 5,
    }),
    // Intentionally computed once on first mount only — subsequent
    // userLoc updates are handled by MapViewController's flyTo, not by
    // recomputing initial center/zoom (which would fight the user's pan/zoom).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    setMounted(true);

    // Explicit teardown on unmount. Leaflet stamps a `_leaflet_id` on the
    // container DOM node when a Map is created; if that isn't cleared
    // before the next mount attempt (React 18 Strict Mode's dev-only
    // double mount/unmount cycle, or Fast Refresh), Leaflet throws
    // "Map container is already initialized." Calling remove() here
    // guarantees the node is clean before any remount.
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!mounted) return null;

  return (
    <MapContainer
      ref={mapRef}
      center={mapConfig.center}
      zoom={mapConfig.zoom}
      className="w-full h-full min-h-[400px] z-0"
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <MapViewController userLoc={userLoc} shops={shops} />

      {userLoc && (
        <Marker position={[userLoc.lat, userLoc.lng]} icon={createUserIcon()}>
          <Popup className="custom-popup">
            <div className="font-sans text-center p-1">
              <p className="text-xs font-bold text-gray-700">You are here</p>
            </div>
          </Popup>
        </Marker>
      )}

      {shops.map(shop => (
        <Marker
          key={shop.shopCode}
          position={[shop.latitude, shop.longitude]}
          icon={createShopIcon(inr(shop.bwPrice))}
        >
          <Popup className="custom-popup border-0 shadow-xl">
            <div className="flex flex-col bg-white">
              {/* Image Banner */}
              {shop.shopImages && shop.shopImages.length > 0 ? (
                <div className="w-full h-28 relative overflow-hidden bg-[#E9EDF1]">
                  <img src={shop.shopImages[0]} className="w-full h-full object-cover" alt={shop.shopName} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="w-full h-20 bg-[#E9EDF1] relative border-b border-[#E1E3E5]">
                  <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                </div>
              )}
              
              <div className="px-4 pb-4 pt-0 relative z-10">
                {/* Shop Icon Overlapping Banner */}
                <div className="w-12 h-12 rounded-full bg-white p-1 shadow-sm border border-[#E1E3E5] -mt-6 mb-2 relative z-20">
                  <div className="w-full h-full rounded-full bg-[#F7F8F8] flex items-center justify-center">
                    <Store className="w-5 h-5 text-[#111111]" />
                  </div>
                </div>
                
                <h3 className="font-bold text-[#111111] text-[16px] leading-tight truncate mb-1">{shop.shopName}</h3>
                <AddressResolver initialName={shop.locationName} lat={shop.latitude} lng={shop.longitude} />

                <div className="flex items-center justify-between border-t border-[#E1E3E5] pt-3 mb-4">
                  <div className="flex gap-4 w-full">
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-bold text-[#8A8F93] uppercase tracking-wider mb-0.5">B&W</span>
                      <span className="text-[13px] font-bold text-[#111111]">{inr(shop.bwPrice)}</span>
                    </div>
                    <div className="w-px h-6 bg-[#E1E3E5]"></div>
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-bold text-[#8A8F93] uppercase tracking-wider mb-0.5">Color</span>
                      <span className="text-[13px] font-bold text-[#111111]">{inr(shop.colorPrice)}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/g2p/${shop.shopCode}`}
                  className="w-full flex items-center justify-center gap-2 bg-[#090909] !text-white py-2.5 rounded-xl text-[13px] font-bold hover:bg-[#262626] transition-colors shadow-sm"
                >
                  Select Shop
                </Link>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}