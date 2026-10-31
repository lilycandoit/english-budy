"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { resolveNativeLanguage } from "@/lib/languages";
import { useSpeech } from "@/lib/useSpeech";

// Keep in sync with app/api/write/generate|refresh/route.ts's MAX_INPUT_CHARS.
const MAX_INPUT_CHARS = 500;
const GROUPS_PER_PAGE = 10;

interface WritingResult {
  id: string;
  nativeText: string;
  englishText: string;
  tip: string;
}

interface HistoryEntry {
  id: string;
  nativeText: string;
  englishText: string;
  tip: string;
  createdAt: string;
}

export function Writing() {
  const { data: session } = useSession();
  const nativeLanguageLabel = resolveNativeLanguage(session?.user?.nativeLanguage);
  const { speak, stop, speaking } = useSpeech();

  const [nativeText, setNativeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WritingResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [visibleGroups, setVisibleGroups] = useState(GROUPS_PER_PAGE);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const res = await fetch("/api/write/sessions");
    if (res.ok) setHistory(await res.json());
  }

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!nativeText.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/write/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nativeText }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setResult({ id: data.id, nativeText, englishText: data.englishText, tip: data.tip });
    setNativeText("");
    loadHistory();
  }

  async function handleRefresh() {
    if (!result) return;
    setRefreshing(true);
    setError("");

    const res = await fetch("/api/write/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nativeText: result.nativeText, currentEnglishText: result.englishText }),
    });

    const data = await res.json();
    setRefreshing(false);

    if (!res.ok) {
      setError(data.error || "Could not refresh");
      return;
    }

    setResult((current) => (current ? { ...current, englishText: data.englishText, tip: data.tip } : current));
  }

  function openHistoryEntry(entry: HistoryEntry) {
    setResult(entry);
    setError("");
  }

  const allDates = Object.keys(history).sort().reverse();
  const visibleDates = allDates.slice(0, visibleGroups);
  const hasMoreDates = visibleDates.length < allDates.length;

  const nearCap = nativeText.length > MAX_INPUT_CHARS * 0.9;

  return (
    <div className="space-y-6">
      {/* Input */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block text-sm font-medium text-ink-primary">
          Write what you want to say in {nativeLanguageLabel} — AI will compose it naturally in English
        </label>
        <textarea
          value={nativeText}
          onChange={(e) => setNativeText(e.target.value)}
          maxLength={MAX_INPUT_CHARS}
          rows={3}
          placeholder={`Write your thought here, in ${nativeLanguageLabel}...`}
          className="w-full bg-surface text-ink-primary border border-strong rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${nearCap ? "text-bad" : "text-ink-muted"}`}>
            {nativeText.length} / {MAX_INPUT_CHARS}
          </span>
        </div>
        {error && <p className="text-bad text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !nativeText.trim()}
          className="w-full sm:w-auto sm:mx-auto sm:block bg-primary text-primary-ink rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "Composing…" : "Compose it"}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">You wrote</p>
            <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">{result.nativeText}</p>
          </div>

          <div className="rounded-xl border border-badge-amber-border bg-badge-amber-bg p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-badge-amber-ink uppercase tracking-wide">In English</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (speaking ? stop() : speak(result.englishText))}
                  title={speaking ? "Stop" : "Listen"}
                  className="text-badge-amber-ink hover:opacity-75 transition-opacity text-sm"
                >
                  {speaking ? "⏹" : "🔊"}
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Generate a different English version"
                  className="inline-flex items-center rounded-lg border border-badge-amber-border bg-surface px-2.5 py-1 text-xs font-medium text-badge-amber-ink hover:bg-surface disabled:opacity-50 transition-colors"
                >
                  {refreshing ? "Refreshing…" : "↻ Fresh version"}
                </button>
              </div>
            </div>
            <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">{result.englishText}</p>
            {result.tip && (
              <p className="text-xs text-badge-amber-ink mt-2 border-l-2 border-badge-amber-border pl-2">{result.tip}</p>
            )}
            <button
              type="button"
              onClick={() => copyText("english", result.englishText)}
              className="mt-3 inline-flex items-center rounded-lg border border-badge-amber-border bg-surface px-3 py-1.5 text-xs font-medium text-badge-amber-ink hover:bg-surface transition-colors"
            >
              {copiedKey === "english" ? "Copied" : "Copy text"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {allDates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink-primary mb-3">History</h3>
          <div className="space-y-3">
            {visibleDates.map((date) => (
              <div key={date} className="border rounded-xl p-3">
                <span className="text-xs font-medium text-ink-muted">
                  {new Date(date).toLocaleDateString("en-AU", {
                    weekday: "short", day: "numeric", month: "short",
                  })}
                </span>
                <div className="mt-2 space-y-1">
                  {history[date].map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => openHistoryEntry(entry)}
                      className="w-full flex items-center justify-between gap-2 text-left text-sm text-ink-secondary hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-sunken"
                    >
                      <span className="truncate">{entry.englishText}</span>
                      <span className="text-xs text-ink-muted flex-shrink-0">
                        {new Date(entry.createdAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {hasMoreDates && (
              <div className="flex items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setVisibleGroups((g) => g + GROUPS_PER_PAGE)}
                  className="text-xs text-primary hover:underline"
                >
                  Show more
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
