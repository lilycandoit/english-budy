"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [groqKey, setGroqKey] = useState("");
  const [groqLoading, setGroqLoading] = useState(false);
  const [groqMsg, setGroqMsg] = useState("");

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
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        {/* ── Groq API Key ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-700">Groq API Key</h3>
            {session?.user?.hasGroqKey && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Powers all AI features — sentence check, vocab builder, daily topic.
          </p>
          <form onSubmit={saveGroqKey} className="flex gap-2">
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder={session?.user?.hasGroqKey ? "Enter new key to update…" : "gsk_..."}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={groqLoading || !groqKey.startsWith("gsk_")}
              className="bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {groqLoading ? "Saving…" : "Update"}
            </button>
          </form>
          {groqMsg && (
            <p className={`text-xs mt-1.5 ${groqMsg === "Saved!" ? "text-green-600" : "text-red-500"}`}>
              {groqMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
