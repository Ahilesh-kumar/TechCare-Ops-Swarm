/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium Black palette tokens
        premium: {
          black:    "#000000",
          panel:    "#0a0a0a",
          card:     "#111111",
          secondary:"#161616",
          tertiary: "#1c1c1e",
          border:   "#1f1f23",
          soft:     "#2a2a2e",
        },
        // Legacy Google design tokens (kept for backward compat)
        google: {
          blue:        "#1a73e8",
          blueHover:   "#1557b0",
          blueLight:   "#f4f8fe",
          blueLightBorder: "#d2e3fc",
          charcoal:    "#202124",
          muted:       "#5f6368",
          bgLight:     "#f4f6f8",
          borderLight: "#dde2e9",
          amber:       "#f9ab00",
          green:       "#1e8e3e",
          graySidebar: "#f1f5f9",
        },
        // Semantic accent colors
        accent: {
          blue:    "#3b82f6",
          blueL:   "#60a5fa",
          glow:    "rgba(59,130,246,0.12)",
        },
        zinc: {
          925: "#111111",
          950: "#09090b",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "SF Pro Text",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        "xl2": "14px",
        "xl3": "18px",
      },
      boxShadow: {
        "premium-card":    "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        "premium-elevated":"0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)",
        "premium-dark-card":    "0 0 0 1px #1f1f23, 0 4px 24px rgba(0,0,0,0.5)",
        "premium-dark-elevated":"0 0 0 1px #2a2a2e, 0 8px 40px rgba(0,0,0,0.7)",
        "glow-blue":  "0 0 0 3px rgba(59,130,246,0.15)",
        "glow-red":   "0 4px 16px rgba(239,68,68,0.35)",
      },
      animation: {
        "slide-up":   "slideUp 0.35s cubic-bezier(0.4,0,0.2,1) forwards",
        "status-dot": "status-dot 2s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      keyframes: {
        slideUp: {
          from: { opacity: 0, transform: "translateY(12px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        "status-dot": {
          "0%, 100%": { opacity: 1 },
          "50%":       { opacity: 0.4 },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(59,130,246,0.15)" },
          "50%":       { boxShadow: "0 0 0 8px transparent" },
        },
      },
    },
  },
  plugins: [],
};
