import type { ReactNode } from "react";

// Carries forward the part-of-speech color system from the original
// WordCard.tsx exactly (blue/violet/amber/teal/green/pink), generalized so
// other tabs (e.g. tone chips) can reuse the same palette instead of
// re-declaring their own color maps. All pairs verified WCAG AA (4.79-6.48:1).
export type BadgeColor = "blue" | "violet" | "amber" | "teal" | "green" | "pink" | "red" | "slate";

// Each color resolves through CSS variables (app/globals.css) with light
// and dark values, so no dark: variant is needed here either.
const COLOR_CLASSES: Record<BadgeColor, string> = {
  blue: "bg-badge-blue-bg text-badge-blue-ink border-badge-blue-border",
  violet: "bg-badge-violet-bg text-badge-violet-ink border-badge-violet-border",
  amber: "bg-badge-amber-bg text-badge-amber-ink border-badge-amber-border",
  teal: "bg-badge-teal-bg text-badge-teal-ink border-badge-teal-border",
  green: "bg-badge-green-bg text-badge-green-ink border-badge-green-border",
  pink: "bg-badge-pink-bg text-badge-pink-ink border-badge-pink-border",
  red: "bg-badge-red-bg text-badge-red-ink border-badge-red-border",
  slate: "bg-badge-slate-bg text-badge-slate-ink border-badge-slate-border",
};

interface BadgeProps {
  color?: BadgeColor;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

// Renders as a button when onClick is given (e.g. clickable tags), a plain
// span otherwise (e.g. part-of-speech labels). Clickable badges get a
// uniform opacity hover instead of a per-color hover shade — avoids needing
// a second CSS variable per color just for the hover state.
export function Badge({ color = "slate", className = "", children, onClick }: BadgeProps) {
  const classes = `text-xs font-semibold px-2.5 py-1 rounded-full border transition-opacity ${COLOR_CLASSES[color]} ${
    onClick ? "hover:opacity-75" : ""
  } ${className}`;

  if (onClick) {
    return (
      <button onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }
  return <span className={classes}>{children}</span>;
}
