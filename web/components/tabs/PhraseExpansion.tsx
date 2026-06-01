"use client";

import { useState } from "react";

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

interface PhraseQuiz {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface PhraseExpansionResult {
  phrase: string;
  meaning: string;
  alternatives: PhraseAlternativeGroup[];
  notes: string[];
  quiz: PhraseQuiz | null;
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

function toneClass(tone: string) {
  const key = tone.toLowerCase();
  return Object.entries(TONE_STYLES).find(([name]) => key.includes(name))?.[1]
    ?? "border-slate-200 bg-slate-50 text-slate-700";
}

export function PhraseExpansion() {
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PhraseExpansionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  async function generate(e?: React.SyntheticEvent) {
    e?.preventDefault();
    if (!phrase.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setSelectedAnswer(null);

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

      {result && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phrase</p>
                <h3 className="mt-1 text-xl font-bold text-slate-800">{result.phrase}</h3>
              </div>
              <button
                type="button"
                onClick={() => copyText(result.phrase)}
                className="w-fit rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {copied === result.phrase ? "Copied" : "Copy"}
              </button>
            </div>
            {result.meaning && (
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{result.meaning}</p>
            )}
          </section>

          {result.alternatives.map((group) => (
            <section key={group.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-800">{group.label}</h3>
                {group.description && (
                  <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <article key={`${group.label}-${item.text}`} className="rounded-xl border border-slate-200 p-4">
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
                    <div className="mt-3 space-y-2 text-sm">
                      {item.whenToUse && (
                        <p className="text-slate-600">
                          <span className="font-medium text-slate-700">Use when: </span>
                          {item.whenToUse}
                        </p>
                      )}
                      {item.avoidWhen && (
                        <p className="text-slate-600">
                          <span className="font-medium text-red-600">Avoid when: </span>
                          {item.avoidWhen}
                        </p>
                      )}
                      {item.example && (
                        <p className="border-l-2 border-slate-200 pl-3 text-slate-500 italic">
                          {item.example}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

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

          {result.quiz && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-800">Practice</h3>
              <p className="mt-2 text-sm text-slate-700">{result.quiz.question}</p>
              <div className="mt-3 space-y-2">
                {result.quiz.options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = option === result.quiz?.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedAnswer(option)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? isCorrect
                            ? "border-green-300 bg-green-50 text-green-800"
                            : "border-red-300 bg-red-50 text-red-800"
                          : "border-slate-200 text-slate-700 hover:border-blue-300"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {selectedAnswer && (
                <p className="mt-3 text-sm text-slate-600">
                  {selectedAnswer === result.quiz.answer ? "Correct. " : `Better answer: ${result.quiz.answer}. `}
                  {result.quiz.explanation}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
