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

const TONE_STYLES: Record<string, { badge: string; active: string; inactive: string }> = {
  casual: {
    badge: "border-teal-200 bg-teal-50 text-teal-800",
    active: "bg-teal-600 text-white border-teal-600",
    inactive: "bg-teal-50 text-teal-700 border-teal-200 hover:opacity-80",
  },
  neutral: {
    badge: "border-badge-blue-border bg-badge-blue-bg text-badge-blue-ink",
    active: "bg-primary text-primary-ink border-primary",
    inactive: "bg-badge-blue-bg text-primary border-badge-blue-border hover:opacity-80",
  },
  formal: {
    badge: "border-violet-200 bg-violet-50 text-violet-800",
    active: "bg-violet-600 text-white border-violet-600",
    inactive: "bg-violet-50 text-violet-700 border-violet-200 hover:opacity-80",
  },
};
const REGION_STYLE = {
  badge: "border-badge-green-border bg-badge-green-bg text-badge-green-ink",
  active: "bg-good text-primary-ink border-good",
  inactive: "bg-badge-green-bg text-badge-green-ink border-badge-green-border hover:opacity-80",
};
const ALL_STYLE = {
  active: "bg-slate-800 text-white border-slate-800",
  inactive: "border text-ink-secondary hover:border-strong",
};

function toneClass(tone: string) {
  return TONE_STYLES[tone.toLowerCase()]?.badge ?? "border bg-surface-sunken text-ink-primary";
}

function filterChipClass(filter: string, active: boolean) {
  if (filter === "All") return active ? ALL_STYLE.active : ALL_STYLE.inactive;
  const toneStyle = TONE_STYLES[filter.toLowerCase()];
  const style = toneStyle ?? REGION_STYLE;
  return active ? style.active : style.inactive;
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
    <article className={`rounded-xl border p-4 ${emphasized ? "border-badge-blue-border bg-badge-blue-bg" : "border bg-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-ink-primary">{item.text}</p>
          {item.tone && (
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(item.tone)}`}>
              {item.tone}
            </span>
          )}
          {item.region && item.region.toLowerCase() !== "general" && (
            <span className="inline-flex rounded-full border border-badge-green-border bg-badge-green-bg px-2 py-0.5 text-xs font-medium text-badge-green-ink">
              {item.region}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {item.example && (
        <p className="mt-3 border-l-2 border pl-3 text-sm italic leading-relaxed text-ink-muted">
          {item.example}
        </p>
      )}
      <div className="mt-3 grid gap-2 text-sm">
        {item.whenToUse && (
          <p className="text-ink-secondary">
            <span className="mr-2 rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted">Best for</span>
            {item.whenToUse}
          </p>
        )}
        {item.avoidWhen && (
          <p className="text-ink-secondary">
            <span className="mr-2 rounded-md bg-bad-wash px-2 py-0.5 text-xs font-semibold text-bad">Avoid</span>
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
  const [activeFilter, setActiveFilter] = useState("All");
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
    setActiveFilter("All");
    setPhrase("");
    loadHistory();
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    window.setTimeout(() => setCopied((current) => current === text ? null : current), 1400);
  }

  const filterOptions = result
    ? ["All", ...Array.from(new Set(result.alternatives.map((item) => item.tone).filter(Boolean))),
       ...Array.from(new Set(result.alternatives.map((item) => item.region).filter((r) => r && r.toLowerCase() !== "general")))]
    : [];
  const filteredAlternatives = result
    ? result.alternatives.filter((item) => activeFilter === "All" || item.tone === activeFilter || item.region === activeFilter)
    : [];
  const recommended = filteredAlternatives.filter((item) => item.recommended);
  const rest = filteredAlternatives.filter((item) => !item.recommended);
  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <div className="space-y-6">
      <form onSubmit={generate} className="space-y-3">
        <label className="block text-sm font-medium text-ink-primary">
          Enter a phrase or expression
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="e.g. keep going"
            className="flex-1 bg-surface text-ink-primary border border-strong rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !phrase.trim()}
            className="bg-primary text-primary-ink rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors whitespace-nowrap"
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
              className="rounded-full border px-3 py-1 text-xs font-medium text-ink-muted hover:border-primary hover:text-primary transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>

      {!result && !loading && (
        <div className="rounded-2xl border bg-surface-sunken p-5">
          <p className="text-sm font-semibold text-ink-primary">Say It Differently</p>
          <p className="mt-1 text-sm text-ink-muted">
            Learn natural alternatives, tone, examples, and when to avoid each phrase.
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3 rounded-2xl border bg-surface p-5">
          <div className="h-4 w-32 rounded bg-surface-sunken" />
          <div className="h-7 w-56 rounded bg-surface-sunken" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-24 rounded-xl border bg-surface-sunken" />
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Hero — the searched phrase itself, elevated */}
          <section className="rounded-2xl border-2 border-badge-blue-border bg-badge-blue-bg p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {result.cached ? "Viewing saved phrase" : "You searched"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-ink-primary">{result.phrase}</h2>
              <button
                type="button"
                onClick={() => speaking ? stop() : speak(result.phrase)}
                title={speaking ? "Stop" : "Listen"}
                className="text-ink-secondary hover:text-primary transition-colors text-lg"
              >
                {speaking ? "⏹" : "🔊"}
              </button>
              <button
                type="button"
                onClick={() => copyText(result.phrase)}
                className="rounded-lg border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-sunken transition-colors"
              >
                {copied === result.phrase ? "Copied" : "Copy"}
              </button>
            </div>
            {result.meaning && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">{result.meaning}</p>
            )}
            {result.savedToWordBank && (
              <p className="mt-3 rounded-lg border border-good-border bg-good-wash px-3 py-2 text-xs font-medium text-good">
                {result.cached ? "Loaded from saved phrases." : "Saved to phrase history."} You can review this phrase later in Words Review.
              </p>
            )}
          </section>

          {filterOptions.length > 2 && (
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filterChipClass(filter, activeFilter === filter)}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}

          {recommended.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">Best ways to say it</h3>
                <p className="mt-0.5 text-xs text-ink-secondary">The most natural, most commonly used options.</p>
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
              <h3 className="text-sm font-semibold text-ink-primary">More ways to say it</h3>
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

          {filteredAlternatives.length === 0 && (
            <p className="text-sm text-ink-secondary text-center py-2">No alternatives match this filter.</p>
          )}

          {result.notes.length > 0 && (
            <section className="rounded-2xl border border-badge-amber-border bg-badge-amber-bg p-5">
              <h3 className="text-sm font-semibold text-badge-amber-ink">Notes</h3>
              <ul className="mt-2 space-y-1.5">
                {result.notes.map((note, index) => (
                  <li key={index} className="text-sm leading-relaxed text-badge-amber-ink">
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section className="rounded-2xl border bg-surface-sunken/70 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">Saved Phrase History</h3>
              <p className="mt-0.5 text-xs text-ink-secondary">Tap a saved phrase to load it instantly from cache.</p>
            </div>
            <span className="text-xs text-ink-secondary">{history.length} saved</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleHistory.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setResult({ ...entry.expansion, cached: true, savedToWordBank: true });
                  setActiveFilter("All");
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  result?.phrase.toLowerCase() === entry.expansion.phrase.toLowerCase()
                    ? "border-primary bg-surface text-primary shadow-sm ring-2 ring-primary/30"
                    : "border text-ink-secondary hover:border-primary hover:text-primary"
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
              className="mt-3 text-xs text-primary hover:underline"
            >
              Show all ({history.length})
            </button>
          )}
        </section>
      )}
    </div>
  );
}
