"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
  className?: string;
}

export function ContextMenu({ children, items, className = "" }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("click", handleGlobalClick);
      return () => window.removeEventListener("click", handleGlobalClick);
    }
  }, [isOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div onContextMenuCapture={handleContextMenu} className={`relative w-full block ${className}`}>
      {children}
      {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ 
              position: "fixed", 
              top: Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 200 : position.y), 
              left: Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 200 : position.x) 
            }}
            className="z-[100] bg-white/70 backdrop-blur-3xl border border-white/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] rounded-2xl py-2 min-w-[200px] overflow-hidden"
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-black/5 ${
                  item.danger ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-gray-700"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
}
