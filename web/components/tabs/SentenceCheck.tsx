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
  grammar:     { label: "Grammar",     color: "bg-badge-red-bg text-badge-red-ink" },
  spelling:    { label: "Spelling",    color: "bg-badge-amber-bg text-badge-amber-ink" },
  punctuation: { label: "Punctuation", color: "bg-badge-violet-bg text-badge-violet-ink" },
  none:        { label: "Correct",     color: "bg-badge-green-bg text-badge-green-ink" },
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
  const [nativeRefreshing, setNativeRefreshing] = useState(false);

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

  function openHistoryEntry(entry: MistakeResult) {
    setResult(entry);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  async function refreshNativeRewrite() {
    if (!result) return;
    setNativeRefreshing(true);
    setError("");

    const res = await fetch("/api/mistakes/native-rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalText: result.originalText,
        correctedText: result.correctedText,
        currentNaturalText: result.naturalText,
      }),
    });

    const data = await res.json();
    setNativeRefreshing(false);

    if (!res.ok) {
      setError(data.error || "Could not refresh native rewrite");
      return;
    }

    setResult((current) => current
      ? {
          ...current,
          naturalText: data.naturalText,
          naturalnessTip: data.naturalnessTip,
        }
      : current
    );
  }

  return (
    <div className="space-y-6">
      {/* Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-ink-primary">
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
          className="w-full bg-surface text-ink-primary border border-strong rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {error && <p className="text-bad text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-full sm:w-auto sm:mx-auto sm:block bg-primary text-primary-ink rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "Checking…" : "Check sentence"}
        </button>
      </form>

      {/* Result boxes */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">You wrote</p>
            <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">{result.originalText}</p>
            <button
              type="button"
              onClick={() => copyText("original", result.originalText)}
              className="mt-3 inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-sunken transition-colors"
            >
              {copiedKey === "original" ? "Copied" : "Copy text"}
            </button>
          </div>

          <div className="rounded-xl border border-badge-blue-border bg-badge-blue-bg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-badge-blue-ink uppercase tracking-wide">Corrected</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_LABELS[result.mistakeType]?.color}`}>
                {TYPE_LABELS[result.mistakeType]?.label}
              </span>
            </div>
            <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">{result.correctedText}</p>
            {result.explanation && result.explanation !== "Looks good!" && (
              <p className="text-xs text-badge-blue-ink mt-2 border-l-2 border-badge-blue-border pl-2">{result.explanation}</p>
            )}
            <button
              type="button"
              onClick={() => copyText("corrected", result.correctedText)}
              className="mt-3 inline-flex items-center rounded-lg border border-badge-blue-border bg-surface px-3 py-1.5 text-xs font-medium text-badge-blue-ink hover:bg-surface transition-colors"
            >
              {copiedKey === "corrected" ? "Copied" : "Copy text"}
            </button>
          </div>

          {result.naturalText && result.naturalText !== result.correctedText && (
            <div className="rounded-xl border border-badge-amber-border bg-badge-amber-bg p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-badge-amber-ink uppercase tracking-wide">Native speaker</p>
                <button
                  type="button"
                  onClick={refreshNativeRewrite}
                  disabled={nativeRefreshing}
                  title="Generate a different native speaker version"
                  className="inline-flex items-center rounded-lg border border-badge-amber-border bg-surface px-2.5 py-1 text-xs font-medium text-badge-amber-ink hover:bg-surface disabled:opacity-50 transition-colors"
                >
                  {nativeRefreshing ? "Refreshing…" : "↻ Fresh version"}
                </button>
              </div>
              <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">{result.naturalText}</p>
              {result.naturalnessTip && (
                <p className="text-xs text-badge-amber-ink mt-2 border-l-2 border-badge-amber-border pl-2">{result.naturalnessTip}</p>
              )}
              <button
                type="button"
                onClick={() => copyText("natural", result.naturalText!)}
                className="mt-3 inline-flex items-center rounded-lg border border-badge-amber-border bg-surface px-3 py-1.5 text-xs font-medium text-badge-amber-ink hover:bg-surface transition-colors"
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
            { key: "grammar",     label: "Grammar",     color: "text-badge-red-ink" },
            { key: "spelling",    label: "Spelling",    color: "text-badge-amber-ink" },
            { key: "punctuation", label: "Punctuation", color: "text-badge-violet-ink" },
          ].map(({ key, label, color }) => (
            <div key={key} className="flex-1 bg-surface-sunken rounded-xl py-3">
              <p className={`text-xl font-bold ${color}`}>{stats[key as keyof Stats]}</p>
              <p className="text-xs text-ink-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {stats && stats.total > 0 && (
        <div>
          <div className="mb-3 space-y-2">
            <h3 className="text-sm font-semibold text-ink-primary">History</h3>
            <div className="flex flex-wrap gap-1">
              {["all", "grammar", "spelling", "punctuation", "none"].map((type) => (
                <button
                  key={type}
                  onClick={() => handleFilterChange(type)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === type
                      ? "bg-primary text-primary-ink"
                      : "bg-surface-sunken text-ink-secondary hover:opacity-80"
                  }`}
                >
                  {type === "all" ? "All" : type === "none" ? "Correct" : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-0.5">
            {history.length === 0 && (
              <p className="text-sm text-ink-secondary py-4 text-center">No entries for this filter.</p>
            )}
            {history.map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => openHistoryEntry(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openHistoryEntry(m);
                  }
                }}
                className="border rounded-xl p-4 text-sm cursor-pointer hover:border-primary hover:bg-surface-sunken transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_LABELS[m.mistakeType]?.color}`}>
                      {TYPE_LABELS[m.mistakeType]?.label}
                    </span>
                    <span className="text-xs text-ink-secondary">
                      {new Date(m.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(m.id);
                    }}
                    className="text-ink-muted hover:text-bad transition-colors text-xs flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-ink-muted line-through text-xs leading-relaxed whitespace-pre-wrap">{m.originalText}</p>
                <p className="text-ink-primary text-sm mt-2 leading-relaxed whitespace-pre-wrap">{m.correctedText}</p>
                {m.naturalText && m.naturalText !== m.correctedText && (
                  <p className="text-badge-teal-ink mt-2 text-xs leading-relaxed whitespace-pre-wrap">💬 {m.naturalText}</p>
                )}
                {m.explanation && m.explanation !== "Looks good!" && (
                  <p className="text-ink-secondary text-xs mt-2 leading-relaxed">💡 {m.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
