"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { resolveNativeLanguage } from "@/lib/languages";
import { simplifyPhonetic } from "@/lib/ipaLookup";
import { Badge } from "@/components/ui/Badge";
import { BilingualTable } from "@/components/BilingualTable";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WbEntry {
  word: string;
  wordInfo: {
    kind?: string;
    ipa?: string;
    meanings?: string[];                                    // legacy format
    forms?: { pos: string; meanings: string[] }[];          // new format
    synonyms?: string[];
    antonyms?: string[];
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
    <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">
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
      <div className="border rounded-2xl p-6 text-center space-y-4">
        <p className="text-xl font-bold text-ink-primary">Session complete!</p>
        <div className="flex gap-4 justify-center">
          <div className="bg-good-wash border border-good-border rounded-xl px-6 py-3">
            <p className="text-2xl font-bold text-good">{knownCount}</p>
            <p className="text-xs text-ink-muted">Known</p>
          </div>
          <div className="bg-badge-amber-bg border border-badge-amber-border rounded-xl px-6 py-3">
            <p className="text-2xl font-bold text-badge-amber-ink">{reviewCount}</p>
            <p className="text-xs text-ink-muted">Review Again</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-primary-ink rounded-xl py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save & update schedule"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-ink-secondary">
        <span>{index + 1} / {cards.length}</span>
        <div className="flex-1 mx-3 bg-surface-sunken rounded-full h-1.5">
          <div
            className="bg-badge-blue-bg0 h-1.5 rounded-full transition-all"
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
            minHeight: "290px",
          }}
        >
          {/* Front — word */}
          <div
            style={{ backfaceVisibility: "hidden" }}
            className="absolute inset-0 border-2 border-badge-blue-border rounded-2xl bg-badge-blue-bg flex flex-col items-center justify-center p-6 overflow-y-auto"
          >
            <p className="text-3xl font-bold text-ink-primary">{card.word}</p>
            {phraseExpansion && (
              <p className="mt-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                phrase
              </p>
            )}
            {card.wordInfo?.ipa && (
              <p className="text-ink-secondary font-mono text-sm mt-2">{simplifyPhonetic(card.wordInfo.ipa)}</p>
            )}
            {!phraseExpansion && (card.wordInfo?.synonyms?.length || card.wordInfo?.antonyms?.length) ? (
              <div className="mt-5 w-full space-y-3">
                {card.wordInfo.synonyms?.length ? (
                  <div>
                    <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Synonyms
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {card.wordInfo.synonyms.slice(0, 4).map((s) => (
                        <Badge key={s} color="green">{s}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {card.wordInfo.antonyms?.length ? (
                  <div>
                    <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Antonyms
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {card.wordInfo.antonyms.slice(0, 3).map((a) => (
                        <Badge key={a} color="red">{a}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="text-xs text-ink-muted mt-6">Tap to reveal</p>
          </div>

          {/* Back — definition */}
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            className="absolute inset-0 border-2 border-badge-teal-border rounded-2xl bg-badge-teal-bg p-5 overflow-y-auto"
          >
            <p className="text-lg font-bold text-ink-primary mb-3">{card.word}</p>
            {phraseExpansion ? (
              <div className="space-y-3">
                {phraseExpansion.meaning && (
                  <p className="text-sm text-ink-secondary">{phraseExpansion.meaning}</p>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                    Alternatives
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getTopAlternatives(phraseExpansion).map((item) => (
                      <span key={item.text} className="rounded-full border border-badge-blue-border bg-badge-blue-bg px-2 py-0.5 text-xs font-medium text-primary">
                        {item.text}
                      </span>
                    ))}
                  </div>
                </div>
                {getTopAlternatives(phraseExpansion, 2).map((item) => item.example).filter(Boolean).map((example) => (
                  <p key={example} className="text-xs text-ink-secondary italic border-l-2 border-badge-teal-border pl-3">
                    {example}
                  </p>
                ))}
              </div>
            ) : (
              <>
                {getMeanings(card.wordInfo).slice(0, 3).map((m, i) => (
                  <li key={i} className="text-sm text-ink-secondary list-none">
                    <span className="text-ink-secondary mr-1">{i + 1}.</span>{m}
                  </li>
                ))}
                {card.wordInfo?.examples?.[0] && (
                  <p className="text-xs text-ink-secondary italic border-l-2 border-badge-teal-border pl-3">
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
            className="flex-1 border-2 border-orange-300 text-badge-amber-ink rounded-xl py-3 text-sm font-medium hover:bg-badge-amber-bg transition-colors"
          >
            🔁 Review Again
          </button>
          <button
            onClick={() => rate("known")}
            className="flex-1 border-2 border-green-400 text-good rounded-xl py-3 text-sm font-medium hover:bg-good-wash transition-colors"
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
  const { data: session } = useSession();
  const nativeLanguageLabel = resolveNativeLanguage(session?.user?.nativeLanguage);

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
            <h3 className="text-sm font-semibold text-ink-primary">Flashcard Review</h3>
            <button onClick={() => setFcCards(null)} className="text-xs text-ink-secondary hover:text-ink-secondary">
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
                className="bg-surface text-badge-amber-ink font-semibold text-sm px-4 py-2 rounded-xl hover:bg-badge-amber-bg transition-colors whitespace-nowrap"
              >
                Start Review →
              </button>
            </div>
          )}

          {/* ── Word selection + review actions ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink-primary">Select Words to Review</h3>
              {wbEntries.length > 0 && (
                <button
                  onClick={() => startFlashcards(wbEntries)}
                  className="text-xs text-ink-secondary hover:text-primary transition-colors"
                >
                  Study all {wbEntries.length} →
                </button>
              )}
            </div>

            {wbEntries.length >= 50 && (
              <p className="text-xs text-badge-amber-ink bg-badge-amber-bg border border-badge-amber-border rounded-lg px-3 py-2 mb-4">
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
                      <div key={date} className="border rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-ink-muted">
                            {new Date(date).toLocaleDateString("en-AU", {
                              weekday: "short", day: "numeric", month: "short",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => selectGroup(words)}
                            className="text-xs text-primary hover:underline"
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
                                  ? "bg-primary text-primary-ink border-primary"
                                  : "border text-ink-secondary hover:border-primary"
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
                        className="text-xs text-primary hover:underline"
                      >
                        Show more ({Math.min(remainingWordsCount, WORDS_PER_PAGE)} more words)
                      </button>
                      <span className="text-ink-muted">·</span>
                      <button
                        type="button"
                        onClick={() => setShowAllDates(true)}
                        className="text-xs text-ink-secondary hover:underline"
                      >
                        Show all ({remainingWordsCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Custom words input */}
              <div>
                <label className="block text-xs text-ink-secondary mb-1">
                  Or type specific words (comma-separated):
                </label>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. reckon, keen, arvo"
                  className="w-full bg-surface text-ink-primary border border-strong rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {storyError && <p className="text-bad text-sm">{storyError}</p>}

              {!isActionBarVisible && (
                <p className="text-xs text-ink-secondary text-center py-2">
                  Select words above to start flashcards or generate a story
                </p>
              )}
            </div>

            {/* Story output */}
            {storyResult && (
              <div className="mt-4 space-y-3 rounded-2xl border p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-primary">
                      {storyResult.mode === "bilingual" ? "Bilingual story" : "Story"}
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-secondary">
                      {storyResult.words.length} word{storyResult.words.length > 1 ? "s" : ""} included
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleGenerateStory(currentStoryMode, "fresh")}
                      disabled={storyLoading}
                      className="rounded-xl border border-badge-blue-border px-3 py-2 text-xs font-medium text-primary hover:bg-badge-blue-bg disabled:opacity-50"
                    >
                      Fresh version
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateStory(storyResult.mode === "bilingual" ? "english" : "bilingual")}
                      disabled={storyLoading}
                      className="rounded-xl border px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-sunken disabled:opacity-50"
                    >
                      {storyResult.mode === "bilingual" ? "English only" : "Bilingual"}
                    </button>
                  </div>
                </div>
                {storyResult.mode === "bilingual" ? (
                  <BilingualTable
                    rows={storyResult.rows}
                    nativeLanguageLabel={nativeLanguageLabel}
                    renderEnglish={(text) => <HighlightedStory text={text} />}
                    renderNative={(text) => <HighlightedStory text={text} />}
                  />
                ) : (
                  <HighlightedStory text={storyResult.story} />
                )}
              </div>
            )}
          </div>

          {/* ── Sticky action bar — reachable without scrolling past the word list ── */}
          {isActionBarVisible && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface px-4 py-3 backdrop-blur shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
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
                  className="bg-primary text-primary-ink rounded-xl py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  {storyLoading ? "Generating…" : `📖 Story (${activeWordsCount} words)`}
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateStory("bilingual")}
                  disabled={storyLoading}
                  className="bg-violet-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {storyLoading ? "Generating…" : `🌐 Bilingual (${nativeLanguageLabel})`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
