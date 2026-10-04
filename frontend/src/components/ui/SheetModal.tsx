"use client";

import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useEffect } from "react";
import { X } from "lucide-react";

interface SheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function SheetModal({ isOpen, onClose, title, children }: SheetModalProps) {
  const dragControls = useDragControls();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-white/60 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col max-h-[85vh] md:max-w-md md:mx-auto"
          >
            <button onClick={onClose} className="absolute right-4 top-4 p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors z-10">
              <X className="w-4 h-4 text-gray-500" />
            </button>
            <div
              className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>
            
            {title && (
              <div className="px-6 pb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
              </div>
            )}
            
            <div className="px-6 pb-8 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
