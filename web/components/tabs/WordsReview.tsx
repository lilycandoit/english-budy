"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NATIVE_LANGUAGE } from "@/lib/languages";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WbEntry {
  word: string;
  wordInfo: {
    kind?: string;
    ipa?: string;
    meanings?: string[];                                    // legacy format
    forms?: { pos: string; meanings: string[] }[];          // new format
    synonyms?: string[];
    examples?: string[];
    phraseExpansion?: PhraseExpansion;
  };
}

interface PhraseAlternative {
  text: string;
  tone: string;
  whenToUse: string;
  avoidWhen: string;
  example: string;
}

// alternatives can be the old grouped shape ([{ label, items: [...] }]) from
// saved phrases predating the Say It Differently redesign, or the current flat
// shape ([{ text, tone, recommended, ... }]) — getTopAlternatives handles both.
interface PhraseExpansion {
  phrase: string;
  meaning: string;
  alternatives: unknown[];
  notes: string[];
}

/** Extract flat meanings from either old or new word format */
function getMeanings(wordInfo: WbEntry["wordInfo"]): string[] {
  if (wordInfo.meanings?.length) return wordInfo.meanings;
  if (wordInfo.forms?.length) {
    return wordInfo.forms.flatMap((f) => f.meanings ?? []);
  }
  return [];
}

function getPhraseExpansion(wordInfo: WbEntry["wordInfo"]): PhraseExpansion | null {
  if (wordInfo.kind !== "phraseExpansion" && !wordInfo.phraseExpansion) return null;
  return wordInfo.phraseExpansion ?? null;
}

function getTopAlternatives(expansion: PhraseExpansion, limit = 5): PhraseAlternative[] {
  const flat = expansion.alternatives.flatMap((entry) => {
    const group = entry as { items?: PhraseAlternative[] };
    return Array.isArray(group.items) ? group.items : [entry as PhraseAlternative];
  });
  return flat.slice(0, limit);
}

interface DueCard {
  word: string;
  wordInfo: WbEntry["wordInfo"];
  daysOverdue: number;
}

type FcRating = "known" | "review";
type StoryMode = "english" | "bilingual";
type StoryVariant = "fresh" | "paraphrase";

interface BilingualStoryRow {
  english: string;
  native: string;
}

type StoryResult =
  | { mode: "english"; story: string; words: string[] }
  | { mode: "bilingual"; rows: BilingualStoryRow[]; words: string[] };

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

function BilingualStory({ rows }: { rows: BilingualStoryRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="hidden sm:grid sm:grid-cols-2 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <div className="border-r border-slate-200 px-4 py-2">English</div>
        <div className="px-4 py-2">{DEFAULT_NATIVE_LANGUAGE.nativeName}</div>
      </div>
      <div className="divide-y divide-slate-200">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-0 sm:grid-cols-2">
            <div className="border-slate-200 px-4 py-3 sm:border-r">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                English
              </p>
              <HighlightedStory text={row.english} />
            </div>
            <div className="bg-slate-50/60 px-4 py-3 sm:bg-white">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                {DEFAULT_NATIVE_LANGUAGE.nativeName}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {row.native}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
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
  const phraseExpansion = getPhraseExpansion(card.wordInfo);

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
            {phraseExpansion && (
              <p className="mt-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                phrase
              </p>
            )}
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
            {phraseExpansion ? (
              <div className="space-y-3">
                {phraseExpansion.meaning && (
                  <p className="text-sm text-slate-600">{phraseExpansion.meaning}</p>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Alternatives
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getTopAlternatives(phraseExpansion).map((item) => (
                      <span key={item.text} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {item.text}
                      </span>
                    ))}
                  </div>
                </div>
                {getTopAlternatives(phraseExpansion, 2).map((item) => item.example).filter(Boolean).map((example) => (
                  <p key={example} className="text-xs text-slate-400 italic border-l-2 border-teal-200 pl-3">
                    {example}
                  </p>
                ))}
              </div>
            ) : (
              <>
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
              </>
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

const WORDS_PER_PAGE = 30;

export function WordsReview() {
  const [wordsByDate, setWordsByDate] = useState<Record<string, string[]>>({});
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [datePage, setDatePage] = useState(1);
  const [showAllDates, setShowAllDates] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyResult, setStoryResult] = useState<StoryResult | null>(null);
  const [storyError, setStoryError] = useState("");
  const [lastStoryWords, setLastStoryWords] = useState<string[]>([]);

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

  function getActiveWords() {
    return customInput.trim()
      ? customInput.split(",").map((w) => w.trim()).filter(Boolean)
      : selectedWords;
  }

  async function handleGenerateStory(
    mode: StoryMode = "english",
    variant?: StoryVariant,
    e?: React.SyntheticEvent
  ) {
    e?.preventDefault();
    const words = variant ? lastStoryWords : getActiveWords();
    if (!words.length) return;

    setStoryLoading(true);
    setStoryError("");
    setStoryResult(null);

    const res = await fetch("/api/review/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words, mode, variant }),
    });

    const data = await res.json();
    setStoryLoading(false);
    if (!res.ok) { setStoryError(data.error || "Something went wrong"); return; }
    setLastStoryWords(data.words ?? words);
    if (data.mode === "bilingual") {
      setStoryResult({ mode: "bilingual", rows: data.rows ?? [], words: data.words ?? words });
    } else {
      setStoryResult({ mode: "english", story: data.story ?? "", words: data.words ?? words });
    }
  }

  // `wordInfo` may be missing here — /api/learning/word-bank's list response
  // only sends { word, isPhrase, updatedAt } now (see Vocabulary Builder's
  // payload fix), so hydrate any card missing full detail before opening
  // the flashcard viewer, which needs it all up front.
  async function startFlashcards(cards: { word: string; wordInfo?: WbEntry["wordInfo"] }[]) {
    const hydrated = await Promise.all(
      cards.map(async (c) => {
        if (c.wordInfo) return c as WbEntry;
        const res = await fetch(`/api/learning/word-bank/${encodeURIComponent(c.word)}`);
        if (res.ok) {
          const data = await res.json();
          return { word: c.word, wordInfo: data.wordInfo };
        }
        return { word: c.word, wordInfo: {} };
      })
    );
    setFcCards(hydrated);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFcDone() {
    setFcCards(null);
    loadDue();
  }

  const allDates = Object.keys(wordsByDate).sort().reverse();
  const activeWords = getActiveWords();
  const activeWordsCount = activeWords.length;
  const flashcardWordsCount = activeWords.filter((word) => wbEntries.some((entry) => entry.word === word)).length;
  const currentStoryMode = storyResult?.mode ?? "english";

  // Show whole date groups (never split one) until reaching ~WORDS_PER_PAGE * datePage words
  const visibleDates: string[] = [];
  if (showAllDates) {
    visibleDates.push(...allDates);
  } else {
    let total = 0;
    for (const date of allDates) {
      visibleDates.push(date);
      total += wordsByDate[date].length;
      if (total >= WORDS_PER_PAGE * datePage) break;
    }
  }
  const hasMoreDates = !showAllDates && visibleDates.length < allDates.length;
  const remainingWordsCount = allDates
    .slice(visibleDates.length)
    .reduce((sum, date) => sum + wordsByDate[date].length, 0);
  const isActionBarVisible = selectedWords.length > 0 || customInput.trim().length > 0;

  return (
    <div className={`space-y-8 ${!fcCards && isActionBarVisible ? "pb-32 sm:pb-20" : ""}`}>

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
                  {visibleDates.map((date) => {
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
                  {hasMoreDates && (
                    <div className="flex items-center justify-center gap-4 pt-1">
                      <button
                        type="button"
                        onClick={() => setDatePage((p) => p + 1)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Show more ({Math.min(remainingWordsCount, WORDS_PER_PAGE)} more words)
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={() => setShowAllDates(true)}
                        className="text-xs text-slate-400 hover:underline"
                      >
                        Show all ({remainingWordsCount} remaining)
                      </button>
                    </div>
                  )}
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

              {!isActionBarVisible && (
                <p className="text-xs text-slate-400 text-center py-2">
                  Select words above to start flashcards or generate a story
                </p>
              )}
            </div>

            {/* Story output */}
            {storyResult && (
              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">
                      {storyResult.mode === "bilingual" ? "Bilingual story" : "Story"}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {storyResult.words.length} word{storyResult.words.length > 1 ? "s" : ""} included
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleGenerateStory(currentStoryMode, "fresh")}
                      disabled={storyLoading}
                      className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    >
                      Fresh version
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateStory(storyResult.mode === "bilingual" ? "english" : "bilingual")}
                      disabled={storyLoading}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {storyResult.mode === "bilingual" ? "English only" : "Bilingual"}
                    </button>
                  </div>
                </div>
                {storyResult.mode === "bilingual" ? (
                  <BilingualStory rows={storyResult.rows} />
                ) : (
                  <HighlightedStory text={storyResult.story} />
                )}
              </div>
            )}
          </div>

          {/* ── Sticky action bar — reachable without scrolling past the word list ── */}
          {isActionBarVisible && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              <div className="mx-auto grid max-w-4xl gap-2 sm:grid-cols-3 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const cards = wbEntries.filter((e) => activeWords.includes(e.word));
                    if (cards.length) startFlashcards(cards);
                  }}
                  className="bg-teal-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-teal-700 transition-colors"
                >
                  🃏 Flashcards ({flashcardWordsCount} words)
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateStory("english")}
                  disabled={storyLoading}
                  className="bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {storyLoading ? "Generating…" : `📖 Story (${activeWordsCount} words)`}
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateStory("bilingual")}
                  disabled={storyLoading}
                  className="bg-violet-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {storyLoading ? "Generating…" : `🌐 Bilingual (${DEFAULT_NATIVE_LANGUAGE.nativeName})`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
