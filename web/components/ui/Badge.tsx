import type { ReactNode } from "react";

// Carries forward the part-of-speech color system from the original
// WordCard.tsx exactly (blue/violet/amber/teal/green/pink), generalized so
// other tabs (e.g. tone chips) can reuse the same palette instead of
// re-declaring their own color maps. All pairs verified WCAG AA (4.79-6.48:1).
export type BadgeColor = "blue" | "violet" | "amber" | "teal" | "green" | "pink" | "red" | "slate";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  green: "bg-green-50 text-green-700 border-green-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
  red: "bg-red-50 text-red-700 border-red-200",
  slate: "bg-slate-50 text-ink-secondary border-slate-200",
};

const HOVER_CLASSES: Record<BadgeColor, string> = {
  blue: "hover:bg-blue-100",
  violet: "hover:bg-violet-100",
  amber: "hover:bg-amber-100",
  teal: "hover:bg-teal-100",
  green: "hover:bg-green-100",
  pink: "hover:bg-pink-100",
  red: "hover:bg-red-100",
  slate: "hover:bg-slate-100",
};

interface BadgeProps {
  color?: BadgeColor;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

// Renders as a button when onClick is given (e.g. clickable tags), a plain
// span otherwise (e.g. part-of-speech labels).
export function Badge({ color = "slate", className = "", children, onClick }: BadgeProps) {
  const classes = `text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${COLOR_CLASSES[color]} ${
    onClick ? HOVER_CLASSES[color] : ""
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
