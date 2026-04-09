"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WbEntry {
  word: string;
  wordInfo: {
    ipa?: string;
    meanings?: string[];                                    // legacy format
    forms?: { pos: string; meanings: string[] }[];          // new format
    synonyms?: string[];
    examples?: string[];
  };
}

/** Extract flat meanings from either old or new word format */
function getMeanings(wordInfo: WbEntry["wordInfo"]): string[] {
  if (wordInfo.meanings?.length) return wordInfo.meanings;
  if (wordInfo.forms?.length) {
    return wordInfo.forms.flatMap((f) => f.meanings ?? []);
  }
  return [];
}

interface DueCard {
  word: string;
  wordInfo: WbEntry["wordInfo"];
  daysOverdue: number;
}

type FcRating = "known" | "review";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Render story text with **word** highlighted */
function HighlightedStory({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
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
    </p>
  );
}

// ── Flashcard viewer ──────────────────────────────────────────────────────────

function FlashcardViewer({
  cards,
  onDone,
}: {
  cards: WbEntry[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, FcRating>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const card = cards[index];

  function rate(result: FcRating) {
    setRatings((r) => ({ ...r, [card.word]: result }));
    if (index < cards.length - 1) {
      setFlipped(false);
      setTimeout(() => setIndex((i) => i + 1), 150);
    } else {
      setDone(true);
    }
  }

  async function handleSave() {
    setSaving(true);
    const reviews = Object.entries(ratings).map(([word, result]) => ({ word, result }));
    await fetch("/api/flashcards/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviews }),
    });
    setSaving(false);
    onDone();
  }

  if (done) {
    const knownCount = Object.values(ratings).filter((r) => r === "known").length;
    const reviewCount = Object.values(ratings).filter((r) => r === "review").length;
    return (
      <div className="border border-slate-200 rounded-2xl p-6 text-center space-y-4">
        <p className="text-xl font-bold text-slate-800">Session complete!</p>
        <div className="flex gap-4 justify-center">
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-3">
            <p className="text-2xl font-bold text-green-600">{knownCount}</p>
            <p className="text-xs text-slate-500">Known</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-3">
            <p className="text-2xl font-bold text-orange-500">{reviewCount}</p>
            <p className="text-xs text-slate-500">Review Again</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save & update schedule"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{index + 1} / {cards.length}</span>
        <div className="flex-1 mx-3 bg-slate-100 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((index + 1) / cards.length) * 100}%` }}
          />
        </div>
        <span>Tap to flip</span>
      </div>

      {/* 3D flip card */}
      <div
        className="cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.4s ease",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
            minHeight: "220px",
          }}
        >
          {/* Front — word */}
          <div
            style={{ backfaceVisibility: "hidden" }}
            className="absolute inset-0 border-2 border-blue-200 rounded-2xl bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center p-6"
          >
            <p className="text-3xl font-bold text-slate-800">{card.word}</p>
            {card.wordInfo?.ipa && (
              <p className="text-slate-400 font-mono text-sm mt-2">{card.wordInfo.ipa}</p>
            )}
            <p className="text-xs text-slate-300 mt-6">Tap to reveal</p>
          </div>

          {/* Back — definition */}
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            className="absolute inset-0 border-2 border-teal-200 rounded-2xl bg-gradient-to-br from-teal-50 to-white p-5 overflow-y-auto"
          >
            <p className="text-lg font-bold text-slate-800 mb-3">{card.word}</p>
            {getMeanings(card.wordInfo).slice(0, 3).map((m, i) => (
              <li key={i} className="text-sm text-slate-600 list-none">
                <span className="text-slate-400 mr-1">{i + 1}.</span>{m}
              </li>
            ))}
            {card.wordInfo?.examples?.[0] && (
              <p className="text-xs text-slate-400 italic border-l-2 border-teal-200 pl-3">
                {card.wordInfo.examples[0]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons — only show after flip */}
      {flipped && (
        <div className="flex gap-3">
          <button
            onClick={() => rate("review")}
            className="flex-1 border-2 border-orange-300 text-orange-600 rounded-xl py-3 text-sm font-medium hover:bg-orange-50 transition-colors"
          >
            🔁 Review Again
          </button>
          <button
            onClick={() => rate("known")}
            className="flex-1 border-2 border-green-400 text-green-700 rounded-xl py-3 text-sm font-medium hover:bg-green-50 transition-colors"
          >
            ✓ Known
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WordsReview() {
  const [wordsByDate, setWordsByDate] = useState<Record<string, string[]>>({});
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [storyLoading, setStoryLoading] = useState(false);
  const [story, setStory] = useState<string | null>(null);
  const [storyError, setStoryError] = useState("");

  const [wbEntries, setWbEntries] = useState<WbEntry[]>([]);
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [fcCards, setFcCards] = useState<WbEntry[] | null>(null);

  useEffect(() => {
    loadWordsByDate();
    loadWordBank();
    loadDue();
  }, []);

  async function loadWordsByDate() {
    const res = await fetch("/api/review/words");
    if (res.ok) setWordsByDate(await res.json());
  }

  async function loadWordBank() {
    const res = await fetch("/api/learning/word-bank");
    if (res.ok) {
      const data = await res.json();
      setWbEntries(data.entries);
    }
  }

  async function loadDue() {
    const res = await fetch("/api/flashcards/due");
    if (res.ok) {
      const data = await res.json();
      setDueCards(data.cards);
    }
  }

  function toggleWord(word: string) {
    setSelectedWords((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  }

  function selectGroup(words: string[]) {
    const allSelected = words.every((w) => selectedWords.includes(w));
    if (allSelected) {
      setSelectedWords((prev) => prev.filter((w) => !words.includes(w)));
    } else {
      setSelectedWords((prev) => [...new Set([...prev, ...words])]);
    }
  }

  async function handleGenerateStory(e?: React.SyntheticEvent) {
    e?.preventDefault();
    const words = customInput.trim()
      ? customInput.split(",").map((w) => w.trim()).filter(Boolean)
      : selectedWords;
    if (!words.length) return;

    setStoryLoading(true);
    setStoryError("");
    setStory(null);

    const res = await fetch("/api/review/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    });

    const data = await res.json();
    setStoryLoading(false);
    if (!res.ok) { setStoryError(data.error || "Something went wrong"); return; }
    setStory(data.story);
  }

  function startFlashcards(cards: WbEntry[]) {
    setFcCards(cards);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFcDone() {
    setFcCards(null);
    loadDue();
  }

  const allDates = Object.keys(wordsByDate).sort().reverse();

  return (
    <div className="space-y-8">

      {/* ── Flashcard session (takes over when active) ── */}
      {fcCards && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Flashcard Review</h3>
            <button onClick={() => setFcCards(null)} className="text-xs text-slate-400 hover:text-slate-600">
              ✕ Cancel
            </button>
          </div>
          <FlashcardViewer cards={fcCards} onDone={handleFcDone} />
        </div>
      )}

      {!fcCards && (
        <>
          {/* ── Due banner ── */}
          {dueCards.length > 0 && (
            <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
              style={{ background: "linear-gradient(135deg, #f97316, #fb923c)" }}>
              <div className="text-white">
                <p className="font-semibold text-sm">
                  🔔 {dueCards.length} word{dueCards.length > 1 ? "s" : ""} due for review
                </p>
                <p className="text-orange-100 text-xs mt-0.5">Keep your streak going!</p>
              </div>
              <button
                onClick={() => startFlashcards(dueCards.map((c) => ({ word: c.word, wordInfo: c.wordInfo })))}
                className="bg-white text-orange-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors whitespace-nowrap"
              >
                Start Review →
              </button>
            </div>
          )}

          {/* ── Word selection + review actions ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Select Words to Review</h3>
              {wbEntries.length > 0 && (
                <button
                  onClick={() => startFlashcards(wbEntries)}
                  className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                >
                  Study all {wbEntries.length} →
                </button>
              )}
            </div>

            {wbEntries.length >= 50 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                💡 You have {wbEntries.length} words — consider reviewing before adding more to keep them manageable.
              </p>
            )}

            <div className="space-y-4">
              {/* Word selection by date */}
              {allDates.length > 0 && (
                <div className="space-y-2">
                  {allDates.map((date) => {
                    const words = wordsByDate[date];
                    const allSel = words.every((w) => selectedWords.includes(w));
                    return (
                      <div key={date} className="border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500">
                            {new Date(date).toLocaleDateString("en-AU", {
                              weekday: "short", day: "numeric", month: "short",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => selectGroup(words)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {allSel ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {words.map((word) => (
                            <button
                              key={word}
                              type="button"
                              onClick={() => toggleWord(word)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                selectedWords.includes(word)
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-slate-200 text-slate-600 hover:border-blue-400"
                              }`}
                            >
                              {word}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Custom words input */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Or type specific words (comma-separated):
                </label>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. reckon, keen, arvo"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {storyError && <p className="text-red-500 text-sm">{storyError}</p>}

              {/* Action buttons */}
              {(selectedWords.length > 0 || customInput.trim()) && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const words = customInput.trim()
                        ? customInput.split(",").map((w) => w.trim()).filter(Boolean)
                        : selectedWords;
                      const cards = wbEntries.filter((e) => words.includes(e.word));
                      if (cards.length) startFlashcards(cards);
                    }}
                    className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-teal-700 transition-colors"
                  >
                    🃏 Flashcards ({(customInput.trim()
                      ? customInput.split(",").map(w => w.trim()).filter(Boolean)
                      : selectedWords
                    ).filter(w => wbEntries.some(e => e.word === w)).length} words)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateStory()}
                    disabled={storyLoading}
                    className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {storyLoading ? "Generating…" : `📖 Story (${selectedWords.length || customInput.split(",").filter(Boolean).length} words)`}
                  </button>
                </div>
              )}

              {!selectedWords.length && !customInput.trim() && (
                <p className="text-xs text-slate-400 text-center py-2">
                  Select words above to start flashcards or generate a story
                </p>
              )}
            </div>

            {/* Story output */}
            {story && (
              <div className="mt-4 border border-slate-200 rounded-2xl p-5">
                <HighlightedStory text={story} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
