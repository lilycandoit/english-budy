import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Every color below resolves to a CSS custom property (see
        // app/globals.css) with light values on :root and dark values
        // under .dark. Components use these plain class names — never a
        // dark: variant — and the variable swap handles both themes.
        page: "var(--color-page)",
        surface: "var(--color-surface)",
        "surface-sunken": "var(--color-surface-sunken)",

        ink: {
          primary: "var(--color-ink-primary)",
          secondary: "var(--color-ink-secondary)",
          muted: "var(--color-ink-muted)",
        },

        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          ink: "var(--color-primary-ink)",
        },

        good: {
          DEFAULT: "var(--color-good)",
          wash: "var(--color-good-wash)",
          border: "var(--color-good-border)",
        },
        bad: {
          DEFAULT: "var(--color-bad)",
          wash: "var(--color-bad-wash)",
          border: "var(--color-bad-border)",
        },

        badge: {
          blue: { bg: "var(--color-badge-blue-bg)", ink: "var(--color-badge-blue-ink)", border: "var(--color-badge-blue-border)" },
          violet: { bg: "var(--color-badge-violet-bg)", ink: "var(--color-badge-violet-ink)", border: "var(--color-badge-violet-border)" },
          amber: { bg: "var(--color-badge-amber-bg)", ink: "var(--color-badge-amber-ink)", border: "var(--color-badge-amber-border)" },
          teal: { bg: "var(--color-badge-teal-bg)", ink: "var(--color-badge-teal-ink)", border: "var(--color-badge-teal-border)" },
          green: { bg: "var(--color-badge-green-bg)", ink: "var(--color-badge-green-ink)", border: "var(--color-badge-green-border)" },
          pink: { bg: "var(--color-badge-pink-bg)", ink: "var(--color-badge-pink-ink)", border: "var(--color-badge-pink-border)" },
          red: { bg: "var(--color-badge-red-bg)", ink: "var(--color-badge-red-ink)", border: "var(--color-badge-red-border)" },
          slate: { bg: "var(--color-badge-slate-bg)", ink: "var(--color-badge-slate-ink)", border: "var(--color-badge-slate-border)" },
        },
      },
      // Separate from `colors` so the bare `border` class (no suffix) picks
      // up DEFAULT automatically, instead of needing the awkward/self-
      // colliding `border-border` that nesting this under `colors.border`
      // would produce.
      borderColor: {
        DEFAULT: "var(--color-border)",
        strong: "var(--color-border-strong)",
      },
    },
  },
  plugins: [],
};
export default config;
