import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-ink rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors",
  secondary:
    "bg-surface text-ink-primary border border-strong rounded-xl px-5 py-2.5 text-sm font-medium hover:border-primary hover:text-primary disabled:opacity-50 transition-colors",
  ghost: "text-ink-muted hover:text-primary transition-colors text-base disabled:opacity-50",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return <button className={`${VARIANT_CLASSES[variant]} ${className}`} {...rest} />;
}
