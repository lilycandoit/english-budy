// Shared 2-column English/native-language table layout — used by Words
// Review's bilingual story mode (with **word**-highlighted cell content) and
// the Translating tab (plain-text cells, no highlighting). Extracted from
// WordsReview.tsx's original BilingualStory so Translating doesn't inherit
// **marker** parsing it doesn't need (user-pasted text can contain literal
// asterisks that aren't highlight markers).

import type { ReactNode } from "react";

export interface BilingualTableRow {
  english: string;
  native: string;
}

function defaultRender(text: string): ReactNode {
  return <span>{text}</span>;
}

/** Render text with **word** markers highlighted — opt-in, pass as a cell renderer. */
export function HighlightedText({ text }: { text: string }) {
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

export function BilingualTable({
  rows,
  nativeLanguageLabel,
  renderEnglish = defaultRender,
  renderNative = defaultRender,
}: {
  rows: BilingualTableRow[];
  nativeLanguageLabel: string;
  renderEnglish?: (text: string, index: number) => ReactNode;
  renderNative?: (text: string, index: number) => ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="hidden sm:grid sm:grid-cols-2 bg-surface-sunken text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        <div className="border-r border px-4 py-2">English</div>
        <div className="px-4 py-2">{nativeLanguageLabel}</div>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-0 sm:grid-cols-2">
            <div className="border px-4 py-3 sm:border-r">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-secondary sm:hidden">
                English
              </p>
              {renderEnglish(row.english, index)}
            </div>
            <div className="bg-surface-sunken/60 px-4 py-3 sm:bg-surface">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-secondary sm:hidden">
                {nativeLanguageLabel}
              </p>
              {renderNative(row.native, index)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
