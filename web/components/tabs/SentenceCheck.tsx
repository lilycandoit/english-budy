"use client";

import { useEffect, useState } from "react";

interface MistakeResult {
  id: string;
  originalText: string;
  correctedText: string;
  naturalText: string | null;
  mistakeType: string;
  explanation: string;
  naturalnessTip: string | null;
  createdAt: string;
}

interface Stats {
  grammar: number;
  spelling: number;
  punctuation: number;
  none: number;
  total: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  grammar:     { label: "Grammar",     color: "bg-red-100 text-red-700" },
  spelling:    { label: "Spelling",    color: "bg-yellow-100 text-yellow-700" },
  punctuation: { label: "Punctuation", color: "bg-purple-100 text-purple-700" },
  none:        { label: "Correct",     color: "bg-green-100 text-green-700" },
};

export function SentenceCheck() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MistakeResult | null>(null);
  const [history, setHistory] = useState<MistakeResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadHistory(), loadStats()]);
  }, []);

  async function loadHistory(type = filter) {
    const res = await fetch(`/api/mistakes${type !== "all" ? `?type=${type}` : ""}`);
    if (res.ok) setHistory(await res.json());
  }

  async function loadStats() {
    const res = await fetch("/api/mistakes/stats");
    if (res.ok) setStats(await res.json());
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setResult(data);
    setInput("");
    loadHistory(filter);
    loadStats();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/mistakes/${id}`, { method: "DELETE" });
    setHistory((h) => h.filter((m) => m.id !== id));
    loadStats();
  }

  async function handleFilterChange(type: string) {
    setFilter(type);
    loadHistory(type);
  }

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1600);
  }

  return (
    <div className="space-y-6">
      {/* Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Write a sentence — AI will correct it and suggest a native rewrite
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !loading) handleSubmit(e as unknown as React.SyntheticEvent);
            }
          }}
          rows={3}
          placeholder="e.g. I have went to the shops yesterday and buyed some milk."
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-full sm:w-auto sm:mx-auto sm:block bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Checking…" : "Check sentence"}
        </button>
      </form>

      {/* Result boxes */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">You wrote</p>
            <p className="text-sm text-slate-800 leading-relaxed">{result.originalText}</p>
            <button
              type="button"
              onClick={() => copyText("original", result.originalText)}
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {copiedKey === "original" ? "Copied" : "Copy text"}
            </button>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Corrected</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_LABELS[result.mistakeType]?.color}`}>
                {TYPE_LABELS[result.mistakeType]?.label}
              </span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">{result.correctedText}</p>
            {result.explanation && result.explanation !== "Looks good!" && (
              <p className="text-xs text-blue-900/70 mt-2 border-l-2 border-blue-300 pl-2">{result.explanation}</p>
            )}
            <button
              type="button"
              onClick={() => copyText("corrected", result.correctedText)}
              className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-white transition-colors"
            >
              {copiedKey === "corrected" ? "Copied" : "Copy text"}
            </button>
          </div>

          {result.naturalText && result.naturalText !== result.correctedText && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Native speaker</p>
              <p className="text-sm text-slate-800 leading-relaxed">{result.naturalText}</p>
              {result.naturalnessTip && (
                <p className="text-xs text-amber-900/75 mt-2 border-l-2 border-amber-300 pl-2">{result.naturalnessTip}</p>
              )}
              <button
                type="button"
                onClick={() => copyText("natural", result.naturalText!)}
                className="mt-3 inline-flex items-center rounded-lg border border-amber-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-white transition-colors"
              >
                {copiedKey === "natural" ? "Copied" : "Copy text"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="flex gap-3 text-center">
          {[
            { key: "grammar",     label: "Grammar",     color: "text-red-600" },
            { key: "spelling",    label: "Spelling",    color: "text-yellow-600" },
            { key: "punctuation", label: "Punctuation", color: "text-purple-600" },
          ].map(({ key, label, color }) => (
            <div key={key} className="flex-1 bg-slate-50 rounded-xl py-3">
              <p className={`text-xl font-bold ${color}`}>{stats[key as keyof Stats]}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {stats && stats.total > 0 && (
        <div>
          <div className="mb-3 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">History</h3>
            <div className="flex flex-wrap gap-1">
              {["all", "grammar", "spelling", "punctuation", "none"].map((type) => (
                <button
                  key={type}
                  onClick={() => handleFilterChange(type)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === type
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {type === "all" ? "All" : type === "none" ? "Correct" : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-0.5">
            {history.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">No entries for this filter.</p>
            )}
            {history.map((m) => (
              <div key={m.id} className="border border-slate-200 rounded-xl p-4 text-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_LABELS[m.mistakeType]?.color}`}>
                      {TYPE_LABELS[m.mistakeType]?.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(m.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors text-xs flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-slate-500 line-through text-xs leading-relaxed">{m.originalText}</p>
                <p className="text-slate-800 text-sm mt-2 leading-relaxed">{m.correctedText}</p>
                {m.naturalText && m.naturalText !== m.correctedText && (
                  <p className="text-teal-700 mt-2 text-xs leading-relaxed">💬 {m.naturalText}</p>
                )}
                {m.explanation && m.explanation !== "Looks good!" && (
                  <p className="text-slate-600 text-xs mt-2 leading-relaxed">💡 {m.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
