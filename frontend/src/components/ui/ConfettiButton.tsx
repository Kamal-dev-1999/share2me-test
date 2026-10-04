"use client";

import { motion } from "framer-motion";
import confetti from "canvas-confetti";

interface ConfettiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function ConfettiButton({ children, onClick, ...props }: ConfettiButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x, y },
      colors: ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EC4899"],
      disableForReducedMotion: true,
      zIndex: 1000,
    });

    if (onClick) onClick(e);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={handleClick}
      {...props}
    >
      {children}
    </motion.button>
  );
}
