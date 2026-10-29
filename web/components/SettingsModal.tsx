"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { COMMON_LANGUAGE_SUGGESTIONS } from "@/lib/languages";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [name, setName] = useState(session?.user?.name ?? "");
  const [nativeLanguage, setNativeLanguage] = useState(session?.user?.nativeLanguage ?? "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [groqKey, setGroqKey] = useState("");
  const [groqLoading, setGroqLoading] = useState(false);
  const [groqMsg, setGroqMsg] = useState("");

  async function saveProfile(e: React.SyntheticEvent) {
    e.preventDefault();
    setNameLoading(true);
    setNameMsg("");
    const res = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nativeLanguage }),
    });
    setNameLoading(false);
    if (res.ok) {
      setNameMsg("Saved!");
      await update();
      router.refresh();
    } else {
      const d = await res.json();
      setNameMsg(d.error || "Failed to save");
    }
  }

  async function saveGroqKey(e: React.SyntheticEvent) {
    e.preventDefault();
    setGroqLoading(true);
    setGroqMsg("");
    const res = await fetch("/api/user/groq-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groqApiKey: groqKey }),
    });
    setGroqLoading(false);
    if (res.ok) {
      setGroqMsg("Saved!");
      setGroqKey("");
      await update();
      router.refresh();
    } else {
      const d = await res.json();
      setGroqMsg(d.error || "Failed to save");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ink-primary">Settings</h2>
          <button onClick={onClose} className="text-ink-secondary hover:text-ink-secondary text-lg">✕</button>
        </div>

        {/* ── Profile ── */}
        <div className="mb-5 pb-5 border-b">
          <h3 className="text-sm font-semibold text-ink-primary mb-3">Profile</h3>
          <form onSubmit={saveProfile} className="space-y-2">
            <div className="flex items-center gap-3">
              <Avatar name={name} email={session?.user?.email} id={session?.user?.id} size={40} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Your name"
                className="flex-1 bg-surface text-ink-primary border border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Native language
              </label>
              <input
                type="text"
                list="native-language-suggestions"
                value={nativeLanguage}
                onChange={(e) => setNativeLanguage(e.target.value)}
                maxLength={60}
                placeholder="e.g. Vietnamese"
                className="w-full bg-surface text-ink-primary border border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <datalist id="native-language-suggestions">
                {COMMON_LANGUAGE_SUGGESTIONS.map((lang) => (
                  <option key={lang} value={lang} />
                ))}
              </datalist>
              <p className="text-xs text-ink-muted mt-1">
                Used for Vocabulary Builder, Say It Differently, and Words Review translations.
              </p>
            </div>
            <button
              type="submit"
              disabled={nameLoading}
              className="w-full bg-primary text-primary-ink rounded-lg px-3 py-2 text-xs font-medium hover:bg-primary-hover disabled:opacity-50"
            >
              {nameLoading ? "Saving…" : "Save profile"}
            </button>
          </form>
          {nameMsg && (
            <p className={`text-xs mt-1.5 ${nameMsg === "Saved!" ? "text-good" : "text-bad"}`}>
              {nameMsg}
            </p>
          )}
        </div>

        {/* ── Groq API Key ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-ink-primary">Groq API Key</h3>
            {session?.user?.hasGroqKey && (
              <span className="text-xs bg-green-100 text-good px-2 py-0.5 rounded-full font-medium">Active</span>
            )}
          </div>
          <p className="text-xs text-ink-muted mb-3">
            Powers all AI features — sentence check, vocab builder, daily topic.
          </p>
          <form onSubmit={saveGroqKey} className="flex gap-2">
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder={session?.user?.hasGroqKey ? "Enter new key to update…" : "gsk_..."}
              className="flex-1 bg-surface text-ink-primary border border-strong rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={groqLoading || !groqKey.startsWith("gsk_")}
              className="bg-primary text-primary-ink rounded-lg px-3 py-2 text-xs font-medium hover:bg-primary-hover disabled:opacity-50 whitespace-nowrap"
            >
              {groqLoading ? "Saving…" : "Update"}
            </button>
          </form>
          {groqMsg && (
            <p className={`text-xs mt-1.5 ${groqMsg === "Saved!" ? "text-good" : "text-bad"}`}>
              {groqMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
