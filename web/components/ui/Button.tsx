import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors",
  secondary:
    "bg-white text-ink-primary border border-line-strong rounded-xl px-5 py-2.5 text-sm font-medium hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors",
  ghost: "text-ink-muted hover:text-blue-500 transition-colors text-base disabled:opacity-50",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return <button className={`${VARIANT_CLASSES[variant]} ${className}`} {...rest} />;
}
