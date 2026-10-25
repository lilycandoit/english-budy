import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        // Semantic text tiers — named (not raw slate-*) so a future dark-mode
        // pass only needs new values here, not a component rewrite.
        // secondary/muted replace slate-400/slate-300, which fail WCAG AA
        // (2.56:1 / 1.48:1 against a 4.5:1 minimum for normal text).
        ink: {
          primary: "#1e293b",   // slate-800, unchanged — 14.6:1
          secondary: "#475569", // slate-600 — 7.6:1 (AAA)
          muted: "#64748b",     // slate-500 — 4.76:1 (AA; use sparingly)
        },
        // Non-text UI-component boundary color for real inputs (WCAG 1.4.11
        // needs 3:1; slate-300 was 1.48:1). Decorative card/container borders
        // are intentionally left on slate-200 — this is for interactive
        // controls only.
        line: {
          strong: "#64748b", // slate-500 — 4.76:1
        },
      },
    },
  },
  plugins: [],
};
export default config;
