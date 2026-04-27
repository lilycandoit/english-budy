"use client";

import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { SettingsModal } from "@/components/SettingsModal";

export function Navbar() {
  const { data: session } = useSession();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-semibold text-slate-800 text-sm">Daily English Buddy</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:block">
              {session?.user?.name || session?.user?.email}
            </span>
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="text-slate-400 hover:text-slate-700 transition-colors text-base"
            >
              ⚙️
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
