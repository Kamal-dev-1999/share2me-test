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
      "2xl": "1440px",
    },
    extend: {
      colors: {
        background: {
          DEFAULT: "#0b0e11",
          secondary: "#181a20",
          elevated: "#2b3139",
          card: "#1e2329",
        },
        primary: {
          DEFAULT: "#fcd535",
          hover: "#f0b90b",
          active: "#f0b90b",
          disabled: "rgba(252, 213, 53, 0.4)",
        },
        status: {
          success: "#0ecb81",
          warning: "#fcd535",
          error: "#f6465d",
        },
        text: {
          primary: "#eaecef",
          secondary: "#cdd1d6",
          tertiary: "#707a8a",
        },
        border: {
          DEFAULT: "#2b3139",
          hover: "#3f4753",
          active: "#474d57",
        },
        // Legacy colors to maintain compatibility while transitioning
        ink:  "#181a20",
        body: {
          DEFAULT: "#A0AEC0",
          light:   "#181a20",
        },
        muted: {
          DEFAULT: "#A0AEC0",
          strong:  "#718096",
        },
        hairline: {
          light: "#eaecef",
          dark:  "rgba(255, 255, 255, 0.08)",
        },
        canvas: {
          light: "#ffffff",
          dark:  "#070B14",
        },
        surface: {
          cardDark:     "#171E2E",
          elevatedDark: "#121827",
          softLight:    "#fafafa",
          strongLight:  "#f5f5f5",
        },
        trading: {
          up:   "#00D26A",
          down: "#FF5D5D",
        },
      },
      fontFamily: {
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body:    ["Inter", "sans-serif"],
        mono:    ["'JetBrains Mono'", "'IBM Plex Mono'", "monospace"],
      },
      fontSize: {
        hero: ["64px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["48px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["36px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["28px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        small: ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "500" }],
      },
      borderRadius: {
        xs:   "4px",
        sm:   "8px",
        md:   "12px",
        lg:   "16px",
        xl:   "20px",
        "2xl": "24px",
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
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(255, 213, 74, 0.15)",
        "glow-active": "0 0 30px rgba(255, 213, 74, 0.3)",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "radar-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in":   "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-ring":"pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin-slow 3s linear infinite",
        "radar-spin": "radar-spin 4s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
