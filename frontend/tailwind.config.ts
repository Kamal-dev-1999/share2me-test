import type { Config } from "tailwindcss";

/**
 * Share2Me — "Kinetic Grid" light brutalist theme.
 * Cream surface + deep-black type + signal-yellow accent + hard offset shadows.
 * All token names preserved from the previous config so existing components
 * are re-themed automatically.
 */
const INK = "#1e1b15";        // Deep black (text + heavy borders)
const CREAM = "#F2F0EF";      // Primary surface — warm off-white
const SIGNAL = "#FFD700";     // Signal yellow (primary accent)
const SIGNAL_HOVER = "#ffe170";
const MUTED = "#525252";      // Secondary text — neutral gray
const SUBTLE = "#737373";     // Tertiary text / outline — neutral gray

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px",
    },
    extend: {
      colors: {
        // --- Surfaces (neutral off-white family) ---
        surface: {
          DEFAULT: CREAM,
          dim: "#d4d4d4",
          bright: CREAM,
          lowest: "#ffffff",
          low: "#f5f5f5",
          container: "#f0f0f0",
          high: "#ebebeb",
          highest: "#e5e5e5",
          card: "#f0f0f0",
          cardDark: "#ebebeb",
          elevatedDark: "#f0f0f0",
          softLight: CREAM,
          strongLight: "#f0f0f0",
          tint: SIGNAL,
          variant: "#e5e5e5",
        },
        "on-surface": INK,
        "on-surface-variant": MUTED,
        "inverse-surface": "#333029",
        "inverse-on-surface": "#f7f0e5",

        outline: {
          DEFAULT: SUBTLE,
          variant: "#d4d4d4",
        },

        // --- Primary (yellow accent) ---
        // `bg-primary`, `text-primary`, etc. stay yellow so all existing calls read as accent.
        primary: {
          DEFAULT: SIGNAL,
          light: "#ffe8a0",
          hover: SIGNAL_HOVER,
          active: "#e6c200",
          disabled: "rgba(255, 215, 0, 0.4)",
          container: SIGNAL,
          "on-container": INK,
          "on-primary": INK,          // text on yellow = deep black
          inverse: "#705d00",
          fixed: "#ffe170",
          "fixed-dim": "#e9c400",
          "on-fixed": "#221b00",
          "on-fixed-variant": "#544600",
        },
        "on-primary": INK,
        "primary-container": SIGNAL,
        "on-primary-container": INK,

        secondary: {
          DEFAULT: "#5e5e5e",
          container: "#e1dfdf",
          "on-secondary": "#ffffff",
          "on-container": "#3d3d3d",
          fixed: "#e4e2e2",
          "fixed-dim": "#c7c6c6",
          "on-fixed": "#1b1c1c",
          "on-fixed-variant": "#464747",
        },
        tertiary: {
          DEFAULT: "#454747",
          container: "#5d5f5f",
          "on-tertiary": "#ffffff",
          "on-container": "#e2e3e2",
          fixed: "#e2e3e2",
          "fixed-dim": "#c6c7c6",
          "on-fixed": "#1a1c1c",
          "on-fixed-variant": "#454747",
        },
        error: {
          DEFAULT: "#ba1a1a",
          "on-error": "#ffffff",
          container: "#ffdad6",
          "on-container": "#93000a",
        },

        background: {
          DEFAULT: CREAM,
          lowest: "#ffffff",
          secondary: "#f5f5f5",
          elevated: "#f0f0f0",
          card: "#f0f0f0",
        },
        "on-background": INK,
        "text-muted": SUBTLE,
        "pure-white": "#FFFFFF",

        // Signal accents used throughout the design system.
        "signal-yellow": SIGNAL,
        "error-red": "#ba1a1a",
        ink: INK,

        // --- Semantic tokens used across the codebase ---
        status: {
          success: "#0e8f5f",
          warning: "#ba8b00",
          error: "#ba1a1a",
        },
        text: {
          primary: INK,
          secondary: MUTED,
          tertiary: SUBTLE,
          muted: SUBTLE,
        },
        border: {
          DEFAULT: INK,       // Bold borders are ink black by default
          hover: INK,
          active: SIGNAL,
        },
        body: {
          DEFAULT: INK,
          light: CREAM,
        },
        muted: {
          DEFAULT: SUBTLE,
          strong: MUTED,
        },
        hairline: {
          light: "#d4d4d4",
          dark: "rgba(30, 27, 21, 0.12)",
        },
        canvas: {
          light: CREAM,
          dark: CREAM,
        },
        trading: {
          up: "#0e8f5f",
          down: "#ba1a1a",
        },
      },

      fontFamily: {
        sans: ["'Comic Neue'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["'Kalam'", "cursive"],
        body: ["'Comic Neue'", "sans-serif"],
        mono: ["'Comic Neue'", "sans-serif"],
      },
      fontSize: {
        "headline-xl": ["64px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["40px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-lg-mobile": ["32px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["28px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "body-lg": ["18px", { lineHeight: "1.6", letterSpacing: "0", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.6", letterSpacing: "0", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "500" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "500" }],
        hero: ["clamp(40px, 10vw, 80px)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["32px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        h3: ["24px", { lineHeight: "1.3", letterSpacing: "0", fontWeight: "700" }],
        body: ["16px", { lineHeight: "1.6", letterSpacing: "0", fontWeight: "400" }],
        small: ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "1.5rem",
        full: "9999px",
        pill: "9999px",
      },
      spacing: {
        base: "8px",
        "gutter-mobile": "16px",
        "gutter-desktop": "24px",
        "margin-edge": "48px",
        "container-max": "1440px",
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "80px",
      },
      boxShadow: {
        // "Hard" offset shadows — the Kinetic Grid signature.
        hard: "4px 4px 0 0 rgba(30, 27, 21, 1)",
        "hard-sm": "2px 2px 0 0 rgba(30, 27, 21, 1)",
        "hard-lg": "6px 6px 0 0 rgba(30, 27, 21, 1)",
        "hard-yellow": "4px 4px 0 0 rgba(255, 215, 0, 1)",
        "hard-white": "4px 4px 0 0 rgba(255, 255, 255, 1)",
        // Legacy names retained for existing components.
        soft: "4px 4px 0 0 rgba(30, 27, 21, 1)",
        glow: "0 0 0 2px rgba(255, 215, 0, 0.35)",
        "glow-active": "0 0 0 3px rgba(255, 215, 0, 0.55)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "radar-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin-slow 3s linear infinite",
        "radar-spin": "radar-spin 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
