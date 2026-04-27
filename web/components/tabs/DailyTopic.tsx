"use client";

import { useEffect, useRef, useState } from "react";
import { WordCard, type WordInfo } from "@/components/WordCard";
import { useSpeech } from "@/lib/useSpeech";

interface TopicWord {
  word: string;
  meaning: string;
  example: string;
}

interface TopicResult {
  id: string;
  topic: string;
  title: string;
  content: string;
  words: TopicWord[];
  format: string;
  level?: string;
}

function cleanWord(w: TopicWord): TopicWord {
  return {
    ...w,
    word: w.word.replace(/\*\*/g, "").trim(),
    example: (w.example ?? "").replace(/\*\*/g, "").trim(),
  };
}

const SUGGESTIONS = [
  "Weekend plans", "Going to a café", "Public transport",
  "Finding a job", "Australian wildlife", "Cooking at home",
];

const FORMAT_OPTIONS = [
  { id: "dialog", label: "💬 Dialog" },
  { id: "story",  label: "📖 Story" },
] as const;

const LEVEL_OPTIONS = [
  { id: "everyday", label: "🌱 Everyday", desc: "Common everyday expressions" },
  { id: "natural",  label: "📈 Natural",  desc: "Richer, more varied language" },
  { id: "advanced", label: "🎓 Advanced", desc: "Sophisticated expressions" },
] as const;

type Format = "dialog" | "story";
type Level = "everyday" | "natural" | "advanced";

function formatLabel(format: string): string {
  const isAussie = format.includes("aussie");
  const base = format.replace("-aussie", "");
  const baseLabel = base === "dialog" ? "💬 Dialog" : "📖 Story";
  return isAussie ? `${baseLabel} · 🦘 Aussie` : baseLabel;
}

function levelLabel(level?: string): string {
  if (level === "natural") return "📈 Natural";
  if (level === "advanced") return "🎓 Advanced";
  return "🌱 Everyday";
}

/** Render a single line with **word** markers highlighted */
function HighlightLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded font-medium">
              {part.slice(2, -2)}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Render content — detects dialog lines (Name: text) and styles them */
function HighlightedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const dialogLineRe = /^([A-Za-z]+):\s*(.*)$/;

  return (
    <div className="text-sm text-slate-700 leading-relaxed space-y-2">
      {lines.map((line, i) => {
        const match = line.match(dialogLineRe);
        if (match) {
          const [, speaker, text] = match;
          return (
            <div key={i} className="flex gap-2">
              <span className="font-bold text-blue-600 min-w-[3.5rem] flex-shrink-0">{speaker}:</span>
              <span><HighlightLine text={text} /></span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return (
          <p key={i}>
            <HighlightLine text={line} />
          </p>
        );
      })}
    </div>
  );
}

export function DailyTopic() {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<Format>("dialog");
  const [level, setLevel] = useState<Level>("everyday");
  const [aussieMode, setAussieMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TopicResult | null>(null);
  const [pastTopics, setPastTopics] = useState<TopicResult[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { speak, stop, speaking } = useSpeech();

  // ── Inline lookup ──────────────────────────────────────────────────────────
  const [popup, setPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [lookupResult, setLookupResult] = useState<WordInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const popupRef = useRef<HTMLButtonElement>(null);

  function handleMouseUp(e: React.MouseEvent) {
    if (popupRef.current?.contains(e.target as Node)) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (text.length < 2 || text.length > 80) { setPopup(null); return; }
    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPopup({ text, x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY + 8 });
  }

  async function lookupWord(text: string) {
    setPopup(null);
    setLookupResult(null);
    setLookupLoading(true);
    const res = await fetch("/api/learning/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: text, quickLookup: true }),
    });
    const data = await res.json();
    setLookupLoading(false);
    if (res.ok && data.words?.[0]) setLookupResult(data.words[0]);
  }

  useEffect(() => { loadPastTopics(); }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!popupRef.current?.contains(e.target as Node)) setPopup(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function loadPastTopics() {
    const res = await fetch("/api/topic/sessions");
    if (res.ok) setPastTopics(await res.json());
  }

  async function generate(excludedPhrases: string[] = []) {
    setLoading(true);
    setError("");

    const res = await fetch("/api/topic/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim(), format, level, aussieMode, excludedPhrases }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error || "Something went wrong"); return; }

    setResult({ ...data, topic: topic.trim() });
    loadPastTopics();
  }

  function handleGenerate(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setResult(null);
    generate();
  }

  function handleFreshVersion() {
    if (!result || !topic.trim()) return;
    // Collect all phrases seen for this topic across all past sessions + current result
    const pastWords = pastTopics
      .filter(s => s.topic?.toLowerCase() === topic.trim().toLowerCase())
      .flatMap(s => s.words.map(w => cleanWord(w).word));
    const currentWords = result.words.map(w => cleanWord(w).word);
    const excluded = [...new Set([...currentWords, ...pastWords])];
    generate(excluded);
  }

  function toggleAccordion(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">

      {/* ── Suggestion chips ── */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Try a topic:</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setTopic(s)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                topic === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Controls + input ── */}
      <form onSubmit={handleGenerate} className="space-y-3">

        {/* Format row */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12 flex-shrink-0">Format</span>
          <div className="flex gap-2">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  format === f.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Level row */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12 flex-shrink-0">Level</span>
          <div className="flex gap-2 flex-wrap">
            {LEVEL_OPTIONS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevel(l.id)}
                title={l.desc}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  level === l.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aussie checkbox */}
        <label className="flex items-center gap-2 cursor-pointer w-fit pl-14">
          <input
            type="checkbox"
            checked={aussieMode}
            onChange={(e) => setAussieMode(e.target.checked)}
            className="accent-amber-500 w-3.5 h-3.5"
          />
          <span className="text-xs text-slate-500">+ 🦘 Aussie flavour</span>
        </label>

        {/* Topic input + generate */}
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic or pick one above…"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      {/* ── Selection popup (fixed, follows cursor) ── */}
      {popup && (
        <button
          ref={popupRef}
          onClick={() => lookupWord(popup.text)}
          style={{ position: "fixed", left: popup.x, top: popup.y - window.scrollY, transform: "translateX(-50%)" }}
          className="z-50 bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          🔍 Look up &ldquo;{popup.text.length > 30 ? popup.text.slice(0, 30) + "…" : popup.text}&rdquo;
        </button>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                {formatLabel(result.format)} · {levelLabel(result.level)}
              </span>
              <div className="flex items-center gap-3">
                {/* Fresh version button */}
                <button
                  onClick={handleFreshVersion}
                  disabled={loading}
                  title="Generate a new version using different phrases"
                  className="text-slate-400 hover:text-blue-500 transition-colors text-xs font-medium disabled:opacity-40"
                >
                  🔄 Fresh version
                </button>
                {/* Listen button (story + dialog) */}
                <button
                  onClick={() => {
                    if (speaking) { stop(); return; }
                    const clean = result.content
                      .replace(/\*\*/g, "")
                      .replace(/^[A-Za-z]+:\s*/gm, "");
                    speak(clean);
                  }}
                  title={speaking ? "Stop" : "Read aloud"}
                  className="text-slate-300 hover:text-blue-500 transition-colors text-sm"
                >
                  {speaking ? "⏹ Stop" : "🔊 Listen"}
                </button>
              </div>
            </div>
            <h3 className="font-semibold text-slate-800 mt-0.5">{result.title}</h3>
          </div>

          <div className="p-5 select-text" onMouseUp={handleMouseUp}>
            <HighlightedContent content={result.content} />
          </div>

          {/* ── Lookup result ── */}
          {(lookupLoading || lookupResult) && (
            <div className="border-t border-blue-100 bg-blue-50 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">🔍 Lookup</p>
                <button
                  onClick={() => { setLookupResult(null); setLookupLoading(false); }}
                  className="text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              </div>
              {lookupLoading ? (
                <p className="text-sm text-slate-500">Looking up…</p>
              ) : lookupResult ? (
                <WordCard w={lookupResult} onDrilldown={(tag) => lookupWord(tag)} />
              ) : null}
            </div>
          )}

          {result.words.length > 0 && (
            <div className="border-t border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Vocabulary — {result.words.length} words
              </p>
              <div className="space-y-2">
                {result.words.map((raw) => {
                  const w = cleanWord(raw);
                  return (
                    <div key={w.word} className="text-sm">
                      <span className="font-semibold text-slate-800">{w.word}</span>
                      <span className="text-slate-400 mx-2">—</span>
                      <span className="text-slate-600">{w.meaning}</span>
                      {w.example && (
                        <p className="text-slate-400 italic text-xs mt-0.5">
                          e.g. {w.example}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Past Topics accordion ── */}
      {pastTopics.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Past Topics</h3>
            {pastTopics.length > 6 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showAll ? "Show less" : `Show all (${pastTopics.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(showAll ? pastTopics : pastTopics.slice(0, 6)).map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAccordion(s.id)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>{formatLabel(s.format)}</span>
                    <span>·</span>
                    <span>{levelLabel(s.level)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm text-slate-700">{s.title}</span>
                    <span className="text-slate-400 text-sm flex-shrink-0">
                      {openId === s.id ? "▾" : "▸"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.words.slice(0, 8).map((raw) => { const w = cleanWord(raw); return (
                      <span key={w.word} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {w.word}
                      </span>
                    );})}
                    {s.words.length > 8 && (
                      <span className="text-xs text-slate-400">+{s.words.length - 8}</span>
                    )}
                  </div>
                </button>

                {openId === s.id && (
                  <div className="border-t border-slate-200">
                    <div className="p-4">
                      <HighlightedContent content={s.content} />
                    </div>
                    {s.words.length > 0 && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Vocabulary
                        </p>
                        <div className="space-y-1.5">
                          {s.words.map((raw) => {
                            const w = cleanWord(raw);
                            return (
                              <div key={w.word} className="text-sm">
                                <span className="font-semibold text-slate-700">{w.word}</span>
                                <span className="text-slate-400 mx-2">—</span>
                                <span className="text-slate-500">{w.meaning}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
