"use client";

import { useCallback, useEffect, useState } from "react";

// The actual theme application on first load happens via an inline script in
// layout.tsx (runs before paint, avoids a flash of the wrong theme). This
// hook just syncs React state with whatever class is already on <html>, and
// handles toggling + persisting the user's explicit choice afterward.
export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {
        // localStorage unavailable (private browsing, etc.) — theme still
        // applies for this session, just won't persist across reloads.
      }
      return next;
    });
  }, []);

  return { isDark, toggle };
}
