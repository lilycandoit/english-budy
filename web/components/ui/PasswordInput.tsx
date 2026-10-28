"use client";

import { useState, type InputHTMLAttributes } from "react";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`w-full bg-surface text-ink-primary border border-strong rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted hover:text-ink-secondary"
        aria-label={show ? "Hide password" : "Show password"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}
