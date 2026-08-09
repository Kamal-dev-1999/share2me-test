"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  label: string;
  value: string;
}

interface GlassSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
}

export function GlassSelect({ value, onChange, options }: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 px-3 bg-surface-container/50 backdrop-blur-md border border-hairline rounded-lg text-[14px] text-on-surface flex items-center justify-between hover:bg-surface-container transition-all outline-none focus:ring-1 focus:ring-ink"
      >
        <span>{selectedOption?.label}</span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown className="w-4 h-4 text-on-surface-variant" strokeWidth={2} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-surface/80 backdrop-blur-xl border border-hairline rounded-lg shadow-soft overflow-hidden"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-3 py-2.5 text-[14px] text-left flex items-center justify-between transition-colors
                  ${value === opt.value ? "bg-ink/5 text-ink font-medium" : "text-on-surface hover:bg-surface-container"}
                `}
              >
                {opt.label}
                {value === opt.value && <Check className="w-4 h-4 text-ink" strokeWidth={2.5} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
