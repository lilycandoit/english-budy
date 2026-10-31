"use client";

import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { SettingsModal } from "@/components/SettingsModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";

export function Navbar() {
  const { data: session } = useSession();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="bg-surface border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-semibold text-ink-primary text-sm">Daily English Buddy</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar name={session?.user?.name} email={session?.user?.email} id={session?.user?.id} size={28} />
              {session?.user?.name && (
                <span className="text-sm text-ink-secondary hidden sm:block">{session.user.name}</span>
              )}
            </div>
            <ThemeToggle />
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="text-ink-muted hover:text-ink-primary transition-colors text-base"
            >
              ⚙️
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-ink-secondary hover:text-ink-primary transition-colors"
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
