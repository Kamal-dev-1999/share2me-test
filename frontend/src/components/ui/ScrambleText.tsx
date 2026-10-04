"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";

interface ScrambleTextProps {
  text: string;
  className?: string;
  hoverTrigger?: boolean;
}

export function ScrambleText({ text, className = "", hoverTrigger = false }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    // If we rely on hover and aren't hovering, just show normal text
    if (hoverTrigger && !isHovering) {
      setDisplayText(text);
      return;
    }
    
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(() =>
        text
          .split("")
          .map((char, index) => {
            if (index < iteration) {
              return text[index];
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );

      if (iteration >= text.length) {
        clearInterval(interval);
        setDisplayText(text);
      }

      iteration += 1 / 3;
    }, 30);

    return () => clearInterval(interval);
  }, [text, isHovering, hoverTrigger]);

  return (
    <motion.span
      className={className}
      onMouseEnter={() => hoverTrigger && setIsHovering(true)}
      onMouseLeave={() => hoverTrigger && setIsHovering(false)}
    >
      {displayText}
    </motion.span>
  );
}
