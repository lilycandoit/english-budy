"use client";

import { useEffect, useState } from "react";
import { useSpeech } from "@/lib/useSpeech";

interface PhraseAlternative {
  text: string;
  tone: string;
  region: string;
  recommended: boolean;
  whenToUse: string;
  avoidWhen: string;
  example: string;
}

interface PhraseExpansionResult {
  phrase: string;
  meaning: string;
  alternatives: PhraseAlternative[];
  notes: string[];
  savedToWordBank: boolean;
  cached?: boolean;
}

interface PhraseHistoryEntry {
  id: string;
  phrase: string;
  updatedAt: string;
  expansion: PhraseExpansionResult;
}

const SUGGESTIONS = [
  "keep going",
  "I think so",
  "no worries",
  "it depends",
  "I'm not sure",
];

const HISTORY_PREVIEW = 10;

const TONE_STYLES: Record<string, string> = {
  casual: "border-teal-200 bg-teal-50 text-teal-800",
  neutral: "border-blue-200 bg-blue-50 text-blue-800",
  formal: "border-violet-200 bg-violet-50 text-violet-800",
};

function toneClass(tone: string) {
  return TONE_STYLES[tone.toLowerCase()] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function AlternativeCard({
  item,
  copied,
  onCopy,
  emphasized = false,
}: {
  item: PhraseAlternative;
  copied: boolean;
  onCopy: () => void;
  emphasized?: boolean;
}) {
  return (
    <article className={`rounded-xl border p-4 ${emphasized ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-slate-800">{item.text}</p>
          {item.tone && (
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(item.tone)}`}>
              {item.tone}
            </span>
          )}
          {item.region && item.region.toLowerCase() !== "general" && (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {item.region}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {item.example && (
        <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm italic leading-relaxed text-slate-500">
          {item.example}
        </p>
      )}
      <div className="mt-3 grid gap-2 text-sm">
        {item.whenToUse && (
          <p className="text-slate-600">
            <span className="mr-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Best for</span>
            {item.whenToUse}
          </p>
        )}
        {item.avoidWhen && (
          <p className="text-slate-600">
            <span className="mr-2 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Avoid</span>
            {item.avoidWhen}
          </p>
        )}
      </div>
    </article>
  );
}

export function PhraseExpansion() {
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PhraseExpansionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<PhraseHistoryEntry[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { speak, stop, speaking } = useSpeech();

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const res = await fetch("/api/phrases/expand");
    if (res.ok) {
      const data = await res.json();
      setHistory(data.entries ?? []);
    }
  }

  async function generate(e?: React.SyntheticEvent) {
    e?.preventDefault();
    if (!phrase.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/phrases/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phrase }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setResult(data);
    setPhrase("");
    loadHistory();
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    window.setTimeout(() => setCopied((current) => current === text ? null : current), 1400);
  }

  const recommended = result?.alternatives.filter((item) => item.recommended) ?? [];
  const rest = result?.alternatives.filter((item) => !item.recommended) ?? [];
  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <div className="space-y-6">
      <form onSubmit={generate} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Enter a phrase or expression
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="e.g. keep going"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !phrase.trim()}
            className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPhrase(item)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>

      {!result && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-700">Say It Differently</p>
          <p className="mt-1 text-sm text-slate-500">
            Learn natural alternatives, tone, examples, and when to avoid each phrase.
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-32 rounded bg-slate-100" />
          <div className="h-7 w-56 rounded bg-slate-100" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-24 rounded-xl border border-slate-200 bg-slate-50" />
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Hero — the searched phrase itself, elevated */}
          <section className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              {result.cached ? "Viewing saved phrase" : "You searched"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-800">{result.phrase}</h2>
              <button
                type="button"
                onClick={() => speaking ? stop() : speak(result.phrase)}
                title={speaking ? "Stop" : "Listen"}
                className="text-slate-400 hover:text-blue-600 transition-colors text-lg"
              >
                {speaking ? "⏹" : "🔊"}
              </button>
              <button
                type="button"
                onClick={() => copyText(result.phrase)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {copied === result.phrase ? "Copied" : "Copy"}
              </button>
            </div>
            {result.meaning && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{result.meaning}</p>
            )}
            {result.savedToWordBank && (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                {result.cached ? "Loaded from saved phrases." : "Saved to phrase history."} You can review this phrase later in Words Review.
              </p>
            )}
          </section>

          {recommended.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Best ways to say it</h3>
                <p className="mt-0.5 text-xs text-slate-400">The most natural, most commonly used options.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {recommended.map((item) => (
                  <AlternativeCard
                    key={item.text}
                    item={item}
                    copied={copied === item.text}
                    onCopy={() => copyText(item.text)}
                    emphasized
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">More ways to say it</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {rest.map((item) => (
                  <AlternativeCard
                    key={item.text}
                    item={item}
                    copied={copied === item.text}
                    onCopy={() => copyText(item.text)}
                  />
                ))}
              </div>
            </section>
          )}

          {result.notes.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-semibold text-amber-900">Notes</h3>
              <ul className="mt-2 space-y-1.5">
                {result.notes.map((note, index) => (
                  <li key={index} className="text-sm leading-relaxed text-amber-900/80">
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Saved Phrase History</h3>
              <p className="mt-0.5 text-xs text-slate-400">Tap a saved phrase to load it instantly from cache.</p>
            </div>
            <span className="text-xs text-slate-400">{history.length} saved</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleHistory.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setResult({ ...entry.expansion, cached: true, savedToWordBank: true })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  result?.phrase.toLowerCase() === entry.expansion.phrase.toLowerCase()
                    ? "border-blue-300 bg-white text-blue-700 shadow-sm ring-2 ring-blue-100"
                    : "border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {entry.expansion.phrase}
              </button>
            ))}
          </div>
          {!showAllHistory && history.length > HISTORY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllHistory(true)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              Show all ({history.length})
            </button>
          )}
        </section>
      )}
    </div>
  );
}
