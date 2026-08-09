import type { Config } from "tailwindcss";

/**
 * Share2Me — "Monochrome Ink" theme.
 * Warm off-white ground, near-black ink accents, hairline borders,
 * subtle ambient shadows. No colour accent — the palette IS the neutrals.
 *
 * Legacy token names are preserved so existing components auto-retheme.
 * `signal-yellow` is intentionally mapped to ink; global overrides in
 * globals.css force contrast on the paired `text-*` classes.
 */
// LoadLogic-inspired palette — modern enterprise SaaS, minimal, data-focused.
const INK        = "#111111";  // Primary text
const INK_HOVER  = "#262626";  // Hover state for primary actions
const BLACK      = "#090909";  // Primary buttons + active navigation
const GROUND     = "#E9EDF1";  // Overall application background (cool blue-gray)
const WHITE      = "#FFFFFF";  // Cards, sidebar, table surfaces
const MUTED      = "#5F6368";  // Supporting text
const SUBTLE     = "#8A8F93";  // Metadata + placeholders
const BORDER     = "#E1E3E5";  // Card and input borders
const MINT_TINT  = "#EEF6F2";  // Reserved for analytics/chart panels only
const MUTED_BG   = "#F7F8F8";  // Secondary surfaces

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
        // --- Surfaces (LoadLogic — cool blue-gray ground, pure-white cards) ---
        surface: {
          DEFAULT: GROUND,
          dim: "#DDE2E7",
          bright: GROUND,
          lowest: WHITE,
          low: MUTED_BG,
          container: WHITE,
          high: MUTED_BG,
          highest: "#EAEDF0",
          card: WHITE,
          cardDark: WHITE,
          elevatedDark: WHITE,
          softLight: GROUND,
          strongLight: WHITE,
          soft: MINT_TINT,
          muted: MUTED_BG,
          tint: BLACK,
          variant: "#EAEDF0",
          mint: MINT_TINT,
        },
        // Flat aliases the codebase already uses.
        "surface-container-lowest":  WHITE,
        "surface-container-low":     MUTED_BG,
        "surface-container-high":    MUTED_BG,
        "surface-container-highest": "#EAEDF0",
        "surface-mint":              MINT_TINT,
        "surface-soft":              MINT_TINT,
        "surface-muted":             MUTED_BG,
        "on-surface": INK,
        "on-surface-variant": MUTED,
        "inverse-surface": INK,
        "inverse-on-surface": WHITE,

        outline: {
          DEFAULT: SUBTLE,
          variant: BORDER,
        },

        // --- Primary (LoadLogic black — used for primary buttons + active nav) ---
        primary: {
          DEFAULT: BLACK,
          light: "#404040",
          hover: INK_HOVER,
          active: "#000000",
          disabled: "rgba(9, 9, 9, 0.4)",
          container: INK_HOVER,
          "on-container": WHITE,
          "on-primary": WHITE,
          inverse: WHITE,
          fixed: BLACK,
          "fixed-dim": INK_HOVER,
          "on-fixed": WHITE,
          "on-fixed-variant": WHITE,
        },
        "on-primary": WHITE,
        "primary-container": INK_HOVER,
        "on-primary-container": WHITE,

        secondary: {
          DEFAULT: MUTED,
          container: "#E8E8E6",
          "on-secondary": WHITE,
          "on-container": INK,
          fixed: "#E8E8E6",
          "fixed-dim": "#D4D4D2",
          "on-fixed": INK,
          "on-fixed-variant": MUTED,
        },
        tertiary: {
          DEFAULT: "#404040",
          container: "#525252",
          "on-tertiary": WHITE,
          "on-container": "#E5E5E4",
          fixed: "#E8E8E6",
          "fixed-dim": "#D4D4D2",
          "on-fixed": INK,
          "on-fixed-variant": "#404040",
        },
        error: {
          DEFAULT: "#DC2626",
          "on-error": "#FFFFFF",
          container: "#FEE2E2",
          "on-container": "#991B1B",
        },

        background: {
          DEFAULT: GROUND,
          lowest: WHITE,
          secondary: "#F7F7F8",
          elevated: WHITE,
          card: WHITE,
          mint: MINT_TINT,
        },
        "on-background": INK,
        "text-muted": SUBTLE,
        "pure-white": WHITE,

        // Legacy tokens — `signal-yellow` now = ink; text/border contrast
        // is enforced by CSS overrides in globals.css (not the token itself).
        "signal-yellow": BLACK,
        "error-red": "#D9534F",
        ink: INK,
        black: BLACK,

        // Status dots — reserved for shipment/transfer state indicators only.
        status: {
          success: "#35B94A",  // in-transit / positive
          warning: "#E98B32",  // picked-up / attention
          danger:  "#D9534F",  // delayed / failed
          error:   "#D9534F",  // alias
        },
        text: {
          primary: INK,
          secondary: MUTED,
          tertiary: SUBTLE,
          muted: SUBTLE,
        },
        border: {
          DEFAULT: BORDER,
          hover:   "#CFD2D5",
          active:  BLACK,
        },
        body: {
          DEFAULT: INK,
          light: GROUND,
        },
        muted: {
          DEFAULT: SUBTLE,
          strong: MUTED,
        },
        hairline: {
          light: BORDER,
          dark:  "#CFD2D5",
        },
        canvas: {
          light: GROUND,
          dark: GROUND,
        },
        trading: {
          up: "#35B94A",
          down: "#D9534F",
        },
      },

      fontFamily: {
        // Inter — the modern SaaS standard. System stack as instant fallback.
        sans:    ["'Inter'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
        display: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body:    ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono:    ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-lg":         ["48px", { lineHeight: "56px", letterSpacing: "-0.028em", fontWeight: "700" }],
        "headline-xl":        ["48px", { lineHeight: "56px", letterSpacing: "-0.028em", fontWeight: "700" }],
        "headline-lg":        ["32px", { lineHeight: "40px", letterSpacing: "-0.022em", fontWeight: "700" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em",  fontWeight: "700" }],
        "headline-md":        ["24px", { lineHeight: "32px", letterSpacing: "-0.02em",  fontWeight: "700" }],
        "title-md":           ["18px", { lineHeight: "26px", letterSpacing: "-0.01em",  fontWeight: "600" }],
        "body-lg":            ["16px", { lineHeight: "24px", letterSpacing: "0", fontWeight: "400" }],
        "body-md":            ["14px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "400" }],
        "body-sm":            ["13px", { lineHeight: "18px", letterSpacing: "0", fontWeight: "400" }],
        "label-md":           ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "500" }],
        "label-sm":           ["11px", { lineHeight: "14px", letterSpacing: "0.02em", fontWeight: "500" }],
        "label-caps":         ["11px", { lineHeight: "14px", letterSpacing: "0.08em", fontWeight: "500" }],
        caption:              ["11px", { lineHeight: "14px", letterSpacing: "0", fontWeight: "400" }],
        hero:                 ["clamp(40px, 6vw, 72px)", { lineHeight: "1.02", letterSpacing: "-0.028em", fontWeight: "700" }],
        h1:                   ["48px", { lineHeight: "56px", letterSpacing: "-0.028em", fontWeight: "700" }],
        h2:                   ["32px", { lineHeight: "40px", letterSpacing: "-0.022em", fontWeight: "700" }],
        h3:                   ["24px", { lineHeight: "32px", letterSpacing: "-0.02em",  fontWeight: "600" }],
        body:                 ["16px", { lineHeight: "24px", letterSpacing: "0", fontWeight: "400" }],
        small:                ["14px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "400" }],
      },
      borderRadius: {
        sm: "0.5rem",       // 8px  — pill secondaries
        DEFAULT: "0.75rem", // 12px — small controls
        md: "0.875rem",     // 14px
        lg: "1rem",         // 16px — cards
        xl: "1.125rem",     // 18px — larger cards
        "2xl": "1.25rem",   // 20px
        "3xl": "1.5rem",    // 24px — hero surfaces
        full: "9999px",
        pill: "9999px",
      },
      spacing: {
        base: "8px",
        "gutter-mobile": "16px",
        "gutter-desktop": "24px",
        "margin-edge": "32px",
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
        // Subtle ambient shadows only — no more hard offset.
        soft:       "0 1px 2px rgba(10, 10, 10, 0.04), 0 1px 3px rgba(10, 10, 10, 0.03)",
        "soft-lg":  "0 4px 12px rgba(10, 10, 10, 0.06), 0 2px 4px rgba(10, 10, 10, 0.04)",
        ambient:    "0 12px 32px rgba(10, 10, 10, 0.12)",
        // Legacy names — kept but replaced with soft equivalents.
        hard:          "0 1px 2px rgba(10, 10, 10, 0.04), 0 1px 3px rgba(10, 10, 10, 0.03)",
        "hard-sm":     "0 1px 2px rgba(10, 10, 10, 0.04)",
        "hard-lg":     "0 4px 12px rgba(10, 10, 10, 0.06)",
        "hard-yellow": "0 4px 12px rgba(10, 10, 10, 0.12)",
        "hard-white":  "0 4px 12px rgba(255, 255, 255, 0.35)",
        glow:          "0 0 0 3px rgba(10, 10, 10, 0.12)",
        "glow-active": "0 0 0 4px rgba(10, 10, 10, 0.2)",
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
