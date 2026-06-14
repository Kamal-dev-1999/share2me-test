"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

export function SplashScreen() {
  const [show, setShow] = useState(true);
  const [render, setRender] = useState(true);
  const [animationData, setAnimationData] = useState<unknown>(null);

  useEffect(() => {
    // Only show the splash screen once per session to avoid annoying the user on reloads
    const isSplashShown = sessionStorage.getItem("splashShown");
    if (isSplashShown) {
      setShow(false);
      setRender(false);
      return;
    }

    // Load animation data dynamically
    import("../../public/animations/8fd5ec48-1150-11ee-b762-3f6010496ba0.json")
      .then((data) => setAnimationData(data.default))
      .catch(console.error);

    // Failsafe timer to hide the splash screen just in case
    const timer = setTimeout(() => {
      handleComplete();
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const handleComplete = () => {
    setShow(false);
    sessionStorage.setItem("splashShown", "true");
    setTimeout(() => setRender(false), 500); // wait for fade out transition
  };

  if (!render) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ease-in-out ${
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
        {animationData ? (
          <Lottie 
            animationData={animationData} 
            loop={false}
            onComplete={handleComplete} 
          />
        ) : null}
      </div>
    </div>
  );
}
