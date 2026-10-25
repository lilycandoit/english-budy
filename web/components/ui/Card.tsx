import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border rounded-2xl p-4 bg-surface ${className}`}>{children}</div>;
}
