"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Folder, Zap, Settings, Command } from "lucide-react";
import { useRouter } from "next/navigation";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const ACTIONS = [
    { id: "p2p", label: "Start P2P Transfer", icon: <Zap className="w-4 h-4 text-orange-500" />, href: "/p2p" },
    { id: "dashboard", label: "Open Dashboard", icon: <Folder className="w-4 h-4 text-blue-500" />, href: "/g2p" },
    { id: "settings", label: "Account Settings", icon: <Settings className="w-4 h-4 text-gray-500" />, href: "/g2p?tab=settings" },
  ];

  const filtered = ACTIONS.filter((action) =>
    action.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 hidden lg:flex">
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-white/70 backdrop-blur-md border border-white/80 shadow-[0_4px_12px_rgba(0,0,0,0.05)] px-4 py-2.5 rounded-full text-[13px] font-semibold text-[#4B4560] hover:text-[#171226] hover:bg-white/90 transition-all active:scale-95"
        >
          <Command className="w-4 h-4" />
          <span>Press ⌘K</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, y: -20, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative w-full max-w-xl mx-4 bg-white/90 backdrop-blur-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.2)] rounded-2xl overflow-hidden"
            >
              <div className="flex items-center px-4 py-4 border-b border-gray-200/50">
                <Search className="w-5 h-5 text-gray-400 mr-3" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Share2Me actions..."
                  className="flex-1 bg-transparent border-none outline-none text-gray-800 placeholder:text-gray-400 text-[15px]"
                />
                <span className="text-[10px] font-bold tracking-wider text-gray-400 bg-gray-100 px-2 py-1 rounded">ESC</span>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[13px] text-gray-500">No actions found.</div>
                ) : (
                  filtered.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => {
                        router.push(action.href);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-gray-700 hover:bg-black/5 rounded-xl transition-colors text-left group"
                    >
                      <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                        {action.icon}
                      </span>
                      <span className="font-semibold text-[#171226]">{action.label}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
