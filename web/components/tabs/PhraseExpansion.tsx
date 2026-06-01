"use client";

import { useEffect, useState } from "react";

interface PhraseAlternative {
  text: string;
  tone: string;
  whenToUse: string;
  avoidWhen: string;
  example: string;
}

interface PhraseAlternativeGroup {
  label: string;
  description: string;
  items: PhraseAlternative[];
}

interface PhraseExpansionResult {
  phrase: string;
  meaning: string;
  alternatives: PhraseAlternativeGroup[];
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

const TONE_STYLES: Record<string, string> = {
  casual: "border-teal-200 bg-teal-50 text-teal-800",
  neutral: "border-blue-200 bg-blue-50 text-blue-800",
  professional: "border-violet-200 bg-violet-50 text-violet-800",
  softer: "border-amber-200 bg-amber-50 text-amber-800",
  stronger: "border-red-200 bg-red-50 text-red-800",
};

const GROUP_STYLES = [
  { key: "casual", accent: "border-teal-300", pill: "bg-teal-600 text-white", soft: "bg-teal-50 text-teal-700 border-teal-200" },
  { key: "neutral", accent: "border-blue-300", pill: "bg-blue-600 text-white", soft: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "professional", accent: "border-violet-300", pill: "bg-violet-600 text-white", soft: "bg-violet-50 text-violet-700 border-violet-200" },
  { key: "softer", accent: "border-amber-300", pill: "bg-amber-500 text-white", soft: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "stronger", accent: "border-red-300", pill: "bg-red-600 text-white", soft: "bg-red-50 text-red-700 border-red-200" },
  { key: "australian", accent: "border-emerald-300", pill: "bg-emerald-600 text-white", soft: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

function toneClass(tone: string) {
  const key = tone.toLowerCase();
  return Object.entries(TONE_STYLES).find(([name]) => key.includes(name))?.[1]
    ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function groupStyle(label: string) {
  const key = label.toLowerCase();
  return GROUP_STYLES.find((style) => key.includes(style.key))
    ?? { accent: "border-slate-300", pill: "bg-slate-700 text-white", soft: "bg-slate-50 text-slate-700 border-slate-200" };
}

function getAlternatives(result: PhraseExpansionResult) {
  return result.alternatives.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label }))
  );
}

function getBestPicks(result: PhraseExpansionResult) {
  const all = getAlternatives(result);
  const picks = [
    {
      label: "Everyday",
      item: all.find((item) => /casual|neutral/i.test(`${item.group} ${item.tone}`)),
    },
    {
      label: "Polite",
      item: all.find((item) => /professional|softer/i.test(`${item.group} ${item.tone}`)),
    },
    {
      label: "Natural",
      item: all.find((item) => /australian|casual/i.test(`${item.group} ${item.tone}`)),
    },
  ];
  const used = new Set<string>();
  return picks.flatMap((pick) => {
    const fallback = all.find((item) => !used.has(item.text));
    const item = pick.item && !used.has(pick.item.text) ? pick.item : fallback;
    if (!item) return [];
    used.add(item.text);
    return [{ label: pick.label, item }];
  });
}

export function PhraseExpansion() {
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PhraseExpansionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<PhraseHistoryEntry[]>([]);
  const [activeGroup, setActiveGroup] = useState("All");

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
    setActiveGroup(data.alternatives?.[0]?.label ?? "All");
    setPhrase("");
    loadHistory();
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    window.setTimeout(() => setCopied((current) => current === text ? null : current), 1400);
  }

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
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-24 rounded-xl border border-slate-200 bg-slate-50" />
            ))}
          </div>
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
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setResult({ ...entry.expansion, cached: true, savedToWordBank: true });
                  setActiveGroup(entry.expansion.alternatives?.[0]?.label ?? "All");
                }}
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
        </section>
      )}

      {result && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {result.cached ? "Viewing saved phrase" : "Current search"}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-800">{result.phrase}</h3>
                {result.meaning && (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{result.meaning}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => copyText(result.phrase)}
                className="w-fit rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {copied === result.phrase ? "Copied" : "Copy"}
              </button>
            </div>
            {result.savedToWordBank && (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                {result.cached ? "Loaded from saved phrases." : "Saved to phrase history."} You can review this phrase later in Words Review.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Best picks</h3>
              <p className="mt-0.5 text-xs text-slate-400">Start with these before exploring every tone.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {getBestPicks(result).map((pick) => (
                <article key={`${pick.label}-${pick.item.text}`} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{pick.label}</span>
                    <button
                      type="button"
                      onClick={() => copyText(pick.item.text)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      {copied === pick.item.text ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-base font-semibold text-slate-800">{pick.item.text}</p>
                  {pick.item.example && (
                    <p className="mt-2 border-l-2 border-blue-200 pl-3 text-sm italic leading-relaxed text-slate-500">
                      {pick.item.example}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveGroup("All")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeGroup === "All"
                    ? "border-slate-700 bg-slate-800 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
              >
                All
              </button>
              {result.alternatives.map((group) => {
                const style = groupStyle(group.label);
                return (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() => setActiveGroup(group.label)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeGroup === group.label
                        ? style.pill
                        : `${style.soft} hover:opacity-80`
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>

            {(activeGroup === "All"
              ? result.alternatives
              : result.alternatives.filter((group) => group.label === activeGroup)
            ).map((group) => {
              const style = groupStyle(group.label);
              return (
                <div key={group.label} className={`mb-5 border-l-4 pl-4 last:mb-0 ${style.accent}`}>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-800">{group.label}</h3>
                    {group.description && (
                      <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.items.map((item) => (
                      <article key={`${group.label}-${item.text}`} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-800">{item.text}</p>
                            {item.tone && (
                              <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(item.tone)}`}>
                                {item.tone}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText(item.text)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                          >
                            {copied === item.text ? "Copied" : "Copy"}
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
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

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
    </div>
  );
}
