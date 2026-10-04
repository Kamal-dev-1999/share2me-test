"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Copy } from "lucide-react";

interface AnimatedCopyIconProps {
  copied: boolean;
  className?: string;
}

export function AnimatedCopyIcon({ copied, className = "w-4 h-4" }: AnimatedCopyIconProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        {copied ? (
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute inset-0 flex items-center justify-center text-[#35B94A]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-full h-full"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                d="M20 6L9 17l-5-5"
              />
            </svg>
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Copy className="w-full h-full" strokeWidth={2} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
