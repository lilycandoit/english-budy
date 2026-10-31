// Shared WordCard component — used by VocabBuilder and DailyTopic lookup

import { useSpeech } from "@/lib/useSpeech";
import { simplifyPhonetic } from "@/lib/ipaLookup";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeColor } from "@/components/ui/Badge";

export interface WordForm {
  pos: string;          // "noun" | "verb" | "adjective" | "adverb" | "phrase" | "idiom" | "slang"
  inflections: string;
  meanings: string[];
}

export interface WordInfo {
  word: string;
  ipa: string;
  translation?: string;            // current format — set at generation/lookup time
  translationLanguage?: string;    // which language `translation` is in (may differ from the user's current preference)
  translations?: { vi?: string };  // legacy format, pre-dating free-text language support — read-only fallback
  compareTo?: string;   // optional bilingual contrastive note against a commonly confused word
  memoryHook?: string;  // optional mnemonic, written entirely in the learner's native language
  forms?: WordForm[];    // rich per-POS data (new format)
  meanings?: string[];  // legacy fallback for old word bank entries
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  examples: string[];
}

const POS_COLORS: Record<string, BadgeColor> = {
  noun: "blue",
  verb: "violet",
  adjective: "amber",
  adverb: "teal",
  phrase: "green",
  idiom: "green",
  slang: "pink",
};

const POS_ABBR: Record<string, string> = {
  noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.",
  phrase: "phrase", idiom: "idiom", slang: "slang",
};

export function WordCard({
  w,
  onDrilldown,
}: {
  w: WordInfo;
  onDrilldown: (tag: string) => void;
}) {
  const { speak, stop, speaking } = useSpeech();
  const nativeTranslation = w.translation ?? w.translations?.vi;
  const translationLabel = w.translation ? w.translationLanguage : w.translations?.vi ? "Vietnamese" : undefined;

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-lg sm:text-xl font-bold text-ink-primary">{w.word}</h3>
            {w.ipa && <span className="text-sm text-ink-secondary font-mono">{simplifyPhonetic(w.ipa)}</span>}
          </div>
          {nativeTranslation && (
            <p className="mt-1 text-sm text-ink-secondary">
              {translationLabel && (
                <span className="font-medium text-ink-secondary">{translationLabel}:</span>
              )}{" "}
              {nativeTranslation}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => (speaking ? stop() : speak(w.word))}
          title={speaking ? "Stop" : "Listen"}
          className="flex-shrink-0 mt-0.5"
        >
          {speaking ? "⏹" : "🔊"}
        </Button>
      </div>

      {/* Per-POS forms (new format) */}
      {w.forms && w.forms.length > 0 ? (
        <div className="space-y-4 mb-4">
          {w.forms.filter((form) => form.pos && form.meanings?.length).map((form, fi) => (
            <div key={fi}>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge color={POS_COLORS[form.pos] ?? "slate"}>{POS_ABBR[form.pos] ?? form.pos}</Badge>
                {form.inflections && (
                  <span className="text-xs text-ink-secondary font-mono">{form.inflections}</span>
                )}
              </div>
              <ul className="space-y-0.5 pl-1">
                {(form.meanings ?? []).map((m, i) => (
                  <li key={i} className="text-sm text-ink-primary">
                    <span className="text-ink-muted mr-1">{i + 1}.</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : w.meanings && w.meanings.length > 0 ? (
        /* Legacy fallback */
        <ul className="space-y-0.5 mb-4">
          {w.meanings.map((m, i) => (
            <li key={i} className="text-sm text-ink-primary">
              <span className="text-ink-muted mr-1">{i + 1}.</span>{m}
            </li>
          ))}
        </ul>
      ) : null}

      <TagRow label="Synonyms" tags={w.synonyms ?? []} color="blue" onDrilldown={onDrilldown} />
      <TagRow label="Antonyms" tags={w.antonyms ?? []} color="red" onDrilldown={onDrilldown} />
      <TagRow label="Collocations" tags={w.collocations ?? []} color="teal" onDrilldown={onDrilldown} />

      {w.compareTo && (
        <div className="mt-3 rounded-lg border border-badge-amber-border bg-badge-amber-bg px-3 py-2">
          <p className="text-xs font-medium text-badge-amber-ink mb-0.5">Compare to</p>
          <p className="text-sm text-ink-primary">{w.compareTo}</p>
        </div>
      )}

      {w.memoryHook && (
        <div className="mt-3 rounded-lg border border-badge-violet-border bg-badge-violet-bg px-3 py-2">
          <p className="text-xs font-medium text-badge-violet-ink mb-0.5">Memory hook</p>
          <p className="text-sm text-ink-primary">{w.memoryHook}</p>
        </div>
      )}

      {(w.examples?.length ?? 0) > 0 && (
        <div className="mt-3 space-y-1.5">
          {w.examples.map((ex, i) => (
            <p key={i} className="text-sm text-ink-secondary italic border-l-2 pl-3">
              {ex}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function TagRow({
  label,
  tags,
  color,
  onDrilldown,
}: {
  label: string;
  tags: string[];
  color: BadgeColor;
  onDrilldown: (tag: string) => void;
}) {
  if (!tags?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-xs text-ink-muted w-20 flex-shrink-0">{label}</span>
      {tags.map((tag) => (
        <Badge key={tag} color={color} onClick={() => onDrilldown(tag)}>
          {tag}
        </Badge>
      ))}
    </div>
  );
}
