"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { resolveNativeLanguage } from "@/lib/languages";
import { BilingualTable, HighlightedText, type BilingualTableRow } from "@/components/BilingualTable";

// Keep in sync with app/api/translate/generate/route.ts's MAX_INPUT_CHARS.
const MAX_INPUT_CHARS = 2000;
const GROUPS_PER_PAGE = 10;
const MIN_SELECTION_CHARS = 2;
const MAX_SELECTION_CHARS = 200;

interface HistoryPreview {
  id: string;
  preview: string;
  createdAt: string;
}

interface TranslateResult {
  id: string;
  rows: BilingualTableRow[];
}

interface SelectionPopup {
  text: string;
  x: number;
  y: number;
}

export function Translating({ onFullSearch }: { onFullSearch: (term: string) => void }) {
  const { data: session } = useSession();
  const nativeLanguageLabel = resolveNativeLanguage(session?.user?.nativeLanguage);

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TranslateResult | null>(null);

  const [history, setHistory] = useState<Record<string, HistoryPreview[]>>({});
  const [visibleGroups, setVisibleGroups] = useState(GROUPS_PER_PAGE);

  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [openEntryRows, setOpenEntryRows] = useState<Record<string, BilingualTableRow[]>>({});
  const [openEntryLoading, setOpenEntryLoading] = useState<string | null>(null);

  // ── Selection popup (Full search only) ──────────────────────────────────────
  const [popup, setPopup] = useState<SelectionPopup | null>(null);
  const popupRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!popupRef.current?.contains(e.target as Node)) setPopup(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function loadHistory() {
    const res = await fetch("/api/translate/sessions");
    if (res.ok) setHistory(await res.json());
  }

  function handleMouseUp(e: React.MouseEvent<HTMLSpanElement>) {
    if (popupRef.current?.contains(e.target as Node)) return;
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() ?? "";
    if (selectedText.length < MIN_SELECTION_CHARS || selectedText.length > MAX_SELECTION_CHARS) {
      setPopup(null);
      return;
    }
    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPopup({ text: selectedText, x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY + 8 });
  }

  function englishCellProps() {
    return { onMouseUp: handleMouseUp };
  }

  function handleFullSearch() {
    if (!popup) return;
    onFullSearch(popup.text);
    setPopup(null);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setPopup(null);

    const res = await fetch("/api/translate/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setResult({ id: data.id, rows: data.rows });
    setText("");
    loadHistory();
  }

  async function toggleEntry(id: string) {
    if (openEntryId === id) {
      setOpenEntryId(null);
      return;
    }
    setOpenEntryId(id);
    if (openEntryRows[id]) return;

    setOpenEntryLoading(id);
    const res = await fetch(`/api/translate/sessions/${id}`);
    setOpenEntryLoading(null);
    if (res.ok) {
      const data = await res.json();
      setOpenEntryRows((prev) => ({ ...prev, [id]: data.rows }));
    }
  }

  const allDates = Object.keys(history).sort().reverse();
  const visibleDates = allDates.slice(0, visibleGroups);
  const hasMoreDates = visibleDates.length < allDates.length;

  const nearCap = text.length > MAX_INPUT_CHARS * 0.9;

  return (
    <div className="space-y-6">
      {/* Input */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block text-sm font-medium text-ink-primary">
          Paste a sentence, comment, or short passage — AI will translate it in context
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_INPUT_CHARS}
          rows={5}
          placeholder="Paste text here — a sentence, a YouTube comment, a transcript line..."
          className="w-full bg-surface text-ink-primary border border-strong rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${nearCap ? "text-bad" : "text-ink-muted"}`}>
            {text.length} / {MAX_INPUT_CHARS}
          </span>
        </div>
        {error && <p className="text-bad text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="w-full sm:w-auto sm:mx-auto sm:block bg-primary text-primary-ink rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "Translating…" : "Translate"}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div>
          <h3 className="text-sm font-semibold text-ink-primary mb-2">Translation</h3>
          <p className="text-xs text-ink-muted mb-2">Select any English text to look it up in Vocabulary Builder.</p>
          <BilingualTable
            rows={result.rows}
            nativeLanguageLabel={nativeLanguageLabel}
            renderEnglish={(t) => <span {...englishCellProps()}><HighlightedText text={t} /></span>}
            renderNative={(t) => <HighlightedText text={t} />}
          />
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
                <div className="mt-2 space-y-2">
                  {history[date].map((entry) => (
                    <div key={entry.id}>
                      <button
                        type="button"
                        onClick={() => toggleEntry(entry.id)}
                        className="w-full flex items-center justify-between gap-2 text-left text-sm text-ink-secondary hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-sunken"
                      >
                        <span className="truncate">{entry.preview}</span>
                        <span className="text-xs text-ink-muted flex-shrink-0">
                          {new Date(entry.createdAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </button>
                      {openEntryId === entry.id && (
                        <div className="mt-2">
                          {openEntryLoading === entry.id ? (
                            <p className="text-sm text-ink-muted px-2">Loading…</p>
                          ) : openEntryRows[entry.id] ? (
                            <BilingualTable
                              rows={openEntryRows[entry.id]}
                              nativeLanguageLabel={nativeLanguageLabel}
                              renderEnglish={(t) => <span {...englishCellProps()}><HighlightedText text={t} /></span>}
                              renderNative={(t) => <HighlightedText text={t} />}
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
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

      {/* ── Selection popup (fixed, follows cursor) ── */}
      {popup && (
        <button
          ref={popupRef}
          onClick={handleFullSearch}
          style={{ position: "fixed", left: popup.x, top: popup.y - window.scrollY, transform: "translateX(-50%)" }}
          className="z-50 bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          🔍 Full search &ldquo;{popup.text.length > 30 ? popup.text.slice(0, 30) + "…" : popup.text}&rdquo;
        </button>
      )}
    </div>
  );
}
