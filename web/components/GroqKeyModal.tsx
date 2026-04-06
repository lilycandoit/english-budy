"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function GroqKeyModal() {
  const { update } = useSession();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/user/groq-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groqApiKey: key }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to save key");
      return;
    }

    // Refresh JWT then re-render the server component so the modal disappears
    await update();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">Connect your Groq API key</h2>
          <p className="text-slate-500 text-sm mt-2">
            Daily English Buddy uses AI to power all features. You need a free Groq API key to get started.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-700">
          <p className="font-medium mb-1">How to get a free key:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
            <li>Go to <strong>console.groq.com</strong></li>
            <li>Sign up for a free account</li>
            <li>Click <strong>API Keys</strong> → <strong>Create API key</strong></li>
            <li>Copy and paste it below</li>
          </ol>
          <p className="mt-2 text-blue-500">Free tier: ~14,400 requests/day — more than enough.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Groq API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              placeholder="gsk_..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">
              Your key is encrypted and stored securely. It is never exposed to anyone else.
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !key.startsWith("gsk_")}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
