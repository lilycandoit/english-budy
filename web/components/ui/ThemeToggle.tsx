"use client";

import { Button } from "@/components/ui/Button";
import { useTheme } from "@/lib/useTheme";

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <Button variant="ghost" onClick={toggle} title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      {isDark ? "☀️" : "🌙"}
    </Button>
  );
}
