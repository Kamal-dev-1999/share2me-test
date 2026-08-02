"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function SplashScreen() {
  const [show, setShow] = useState(true);
  const [render, setRender] = useState(true);

  useEffect(() => {
    // Only show the splash screen once per session
    const isSplashShown = sessionStorage.getItem("splashShown");
    if (isSplashShown) {
      setShow(false);
      setRender(false);
      return;
    }

    const timer = setTimeout(() => {
      handleComplete();
    }, 3200); 
    return () => clearTimeout(timer);
  }, []);

  const handleComplete = () => {
    setShow(false);
    sessionStorage.setItem("splashShown", "true");
    setTimeout(() => setRender(false), 800); 
  };

  if (!render) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-700 ease-in-out ${
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="relative flex flex-col items-center justify-center gap-8">
        {/* Pulsing background rings */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.15, 0], scale: [0.8, 1.5, 2] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          className="absolute w-24 h-24 bg-primary rounded-full blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.3, 0], scale: [0.8, 2, 2.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
          className="absolute w-24 h-24 border border-primary rounded-full"
        />

        {/* Logo Icon Container */}
        <motion.div 
          initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="relative z-10 w-24 h-24 rounded-2xl bg-primary flex items-center justify-center border-2 border-ink shadow-hard"
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
            <motion.path 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut", delay: 0.3 }}
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            />
            <motion.path 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut", delay: 0.7 }}
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            />
          </svg>
        </motion.div>

        {/* Brand Text & Loading indicator */}
        <div className="flex flex-col items-center gap-3">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 1.4 }}
            className="text-3xl font-display font-bold text-on-surface uppercase tracking-wider"
          >
            Share2Me
          </motion.h1>

          {/* Loading Dots */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.8 }}
            className="flex items-center gap-1.5"
          >
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
