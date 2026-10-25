import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border border-slate-200 rounded-2xl p-4 bg-white ${className}`}>{children}</div>;
}
