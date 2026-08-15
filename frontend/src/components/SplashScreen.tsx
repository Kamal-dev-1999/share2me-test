"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { FileText, Image as ImageIcon, Video, Music, Archive, Zap } from "lucide-react";

const ICONS = [
  { Icon: FileText, color: "#F87171" },
  { Icon: ImageIcon, color: "#60A5FA" },
  { Icon: Video, color: "#A78BFA" },
  { Icon: Music, color: "#F472B6" },
  { Icon: Archive, color: "#4ADE80" },
];

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
    setTimeout(() => setRender(false), 1000); 
  };

  if (!render) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#CDC3E4] transition-opacity duration-1000 ease-in-out overflow-hidden ${
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Background glowing orbs */}
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] rounded-full blur-[100px] opacity-40 bg-gradient-to-tr from-[#8B5CF6] via-[#EC4899] to-[#F59E0B]"
      />
      
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
        {/* Core orbit system */}
        <div className="relative w-[280px] h-[280px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
          
          {/* Orbiting files - responsive radius */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            {ICONS.map((item, index) => {
              const angle = (360 / ICONS.length) * index;
              return (
                <div 
                  key={index} 
                  className="absolute inset-0 pointer-events-none"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <motion.div
                    initial={{ y: 0, opacity: 0, scale: 0 }}
                    animate={{ 
                      y: [0, -90, -140, -90, 0], // Move outwards then inwards
                      opacity: [0, 1, 1, 1, 0],
                      scale: [0.3, 1, 1.2, 1, 0.3]
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity, 
                      delay: index * 0.8,
                      ease: "easeInOut" 
                    }}
                    className="absolute left-1/2 -translate-x-1/2"
                  >
                    {/* Counter-rotate so icons stay upright */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                      className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-xl"
                      style={{ boxShadow: `0 0 25px ${item.color}40` }}
                    >
                      <item.Icon className="w-5 h-5 sm:w-7 sm:h-7" color={item.color} strokeWidth={2.5} />
                    </motion.div>
                  </motion.div>
                </div>
              );
            })}
          </motion.div>

          {/* Center Logo container */}
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, type: "spring", bounce: 0.5 }}
            className="relative z-20 w-24 h-24 sm:w-32 sm:h-32 rounded-[24px] sm:rounded-[32px] overflow-hidden bg-black flex items-center justify-center shadow-[0_0_80px_rgba(124,58,237,0.4)] border border-[#7C3AED]/40"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-full h-full p-4 sm:p-5 flex items-center justify-center"
            >
              <Image
                src="/logo.png"
                alt="Share2Me Logo"
                width={128}
                height={128}
                className="w-full h-full object-contain"
                priority
              />
            </motion.div>
            
            {/* Inner pulse sweep */}
            <motion.div
              animate={{ opacity: [0, 0.4, 0], scale: [0.8, 1.2, 1.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-tr from-[#7C3AED]/30 to-transparent pointer-events-none rounded-full blur-md"
            />
          </motion.div>

          {/* Outer ripples */}
          <motion.div
             animate={{ scale: [1, 2, 2.5], opacity: [0.5, 0, 0] }}
             transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
             className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-[32px] border-2 border-[#7C3AED]/50 pointer-events-none z-10"
          />
        </div>

        {/* Text and loader */}
        <div className="mt-4 sm:mt-8 flex flex-col items-center gap-5">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.5 }}
             className="flex items-center gap-2"
          >
             <h1 className="text-3xl sm:text-5xl font-extrabold text-[#171226] tracking-tight">
               Share2Me
             </h1>
          </motion.div>
          
        </div>
      </div>
    </div>
  );
}
