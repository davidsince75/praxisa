import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Psychostudy design tokens
        // AA-compliant text colors (>=4.5:1 on white and cream backgrounds).
        // teal/rose/olive were darkened in the 2026-06 accessibility pass —
        // do not lighten without re-checking ratios (see docs/accessibility.md).
        teal: {
          DEFAULT: "#4A6F96", // 5.24:1 on white
          dark: "#3E608A", // 6.47:1 on white (hover)
          light: "#8FB0D4", // 7.4:1 on #1A1A18 — dark surfaces only
        },
        rose: {
          DEFAULT: "#A04E3C", // 5.75:1 on white — light backgrounds
          light: "#C07060", // 4.75:1 on #1A1A18 — dark backgrounds only
        },
        sand: "#C8A97C", // decorative tints only — not for text
        olive: "#656E49", // 5.41:1 on white
        steel: "#A8B5BE", // decorative tints only — not for text
        cream: {
          DEFAULT: "#F2EEE8",
          mid: "#E8E2D9",
        },
        dark: "#1A1A18",
        mid: "#4A4845",
        meta: "#6B6862", // 5.55:1 on white, 4.8:1 on cream
        rule: "#D8D2C8",
        // shadcn/ui CSS variable mapping
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.125rem", { lineHeight: "1.6" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
