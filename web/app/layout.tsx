import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Daily English Buddy",
  description: "Your personal AI English learning companion",
};

// Runs before paint, before React hydrates — applies the stored/OS theme
// immediately so there's no flash of the wrong theme on load.
const THEME_INIT_SCRIPT = `
  (function () {
    try {
      var stored = localStorage.getItem("theme");
      var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (dark) document.documentElement.classList.add("dark");
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
