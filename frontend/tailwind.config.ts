import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      xs:  "480px",
      sm:  "640px",
      md:  "768px",
      lg:  "1024px",
      xl:  "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#fcd535",
          active:  "#f0b90b",
          disabled:"#3a3a1f",
        },
        ink:  "#181a20",
        body: {
          DEFAULT: "#eaecef",
          light:   "#181a20",
        },
        muted: {
          DEFAULT: "#707a8a",
          strong:  "#929aa5",
        },
        hairline: {
          light: "#eaecef",
          dark:  "#2b3139",
        },
        border: { strong: "#cdd1d6" },
        canvas: {
          light: "#ffffff",
          dark:  "#0b0e11",
        },
        surface: {
          cardDark:     "#1e2329",
          elevatedDark: "#2b3139",
          softLight:    "#fafafa",
          strongLight:  "#f5f5f5",
        },
        trading: {
          up:   "#0ecb81",
          down: "#f6465d",
        },
        accent: { turquoise: "#2dbdb6" },
        info:   "#3b82f6",
      },
      fontFamily: {
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body:    ["Inter", "sans-serif"],
        mono:    ["'JetBrains Mono'", "'IBM Plex Mono'", "monospace"],
      },
      fontSize: {
        "hero":   ["64px", { lineHeight: "1.1",  letterSpacing: "-1px",   fontWeight: "700" }],
        "disp-lg":["48px", { lineHeight: "1.1",  letterSpacing: "-0.5px", fontWeight: "700" }],
        "disp-md":["40px", { lineHeight: "1.15", letterSpacing: "-0.3px", fontWeight: "600" }],
        "disp-sm":["32px", { lineHeight: "1.2",  letterSpacing: "0",      fontWeight: "600" }],
        "title-lg":["24px",{ lineHeight: "1.3",  letterSpacing: "0",      fontWeight: "600" }],
        "title-md":["20px",{ lineHeight: "1.35", letterSpacing: "0",      fontWeight: "600" }],
        "title-sm":["16px",{ lineHeight: "1.4",  letterSpacing: "0",      fontWeight: "600" }],
      },
      borderRadius: {
        xs:   "2px",
        sm:   "4px",
        md:   "6px",
        lg:   "8px",
        xl:   "12px",
        pill: "9999px",
      },
      spacing: {
        xxs: "4px",
        xs:  "8px",
        sm:  "12px",
        md:  "16px",
        lg:  "24px",
        xl:  "32px",
        xxl: "48px",
        section: "80px",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in":   "fade-in 0.35s ease both",
        "pulse-ring":"pulse-ring 2s ease-in-out infinite",
        "spin-slow": "spin-slow 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
