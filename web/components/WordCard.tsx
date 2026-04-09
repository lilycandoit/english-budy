// Shared WordCard component — used by VocabBuilder and DailyTopic lookup

export interface WordForm {
  pos: string;          // "noun" | "verb" | "adjective" | "adverb" | "phrase" | "idiom" | "slang"
  inflections: string;
  meanings: string[];
}

export interface WordInfo {
  word: string;
  ipa: string;
  stress: string;
  forms?: WordForm[];    // rich per-POS data (new format)
  meanings?: string[];  // legacy fallback for old word bank entries
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  examples: string[];
}

const POS_COLORS: Record<string, string> = {
  noun:      "bg-blue-50 text-blue-700 border-blue-200",
  verb:      "bg-violet-50 text-violet-700 border-violet-200",
  adjective: "bg-amber-50 text-amber-700 border-amber-200",
  adverb:    "bg-teal-50 text-teal-700 border-teal-200",
  phrase:    "bg-green-50 text-green-700 border-green-200",
  idiom:     "bg-green-50 text-green-700 border-green-200",
  slang:     "bg-pink-50 text-pink-700 border-pink-200",
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
  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white">
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-4">
        <h3 className="text-xl font-bold text-slate-800">{w.word}</h3>
        {w.ipa && <span className="text-sm text-slate-400 font-mono">{w.ipa}</span>}
        {w.stress && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{w.stress}</span>}
      </div>

      {/* Per-POS forms (new format) */}
      {w.forms && w.forms.length > 0 ? (
        <div className="space-y-4 mb-4">
          {w.forms.filter((form) => form.pos && form.meanings?.length).map((form, fi) => {
            const colorClass = POS_COLORS[form.pos] ?? "bg-slate-50 text-slate-600 border-slate-200";
            return (
              <div key={fi}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
                    {POS_ABBR[form.pos] ?? form.pos}
                  </span>
                  {form.inflections && (
                    <span className="text-xs text-slate-400 font-mono">{form.inflections}</span>
                  )}
                </div>
                <ul className="space-y-0.5 pl-1">
                  {(form.meanings ?? []).map((m, i) => (
                    <li key={i} className="text-sm text-slate-700">
                      <span className="text-slate-400 mr-1">{i + 1}.</span>{m}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : w.meanings && w.meanings.length > 0 ? (
        /* Legacy fallback */
        <ul className="space-y-0.5 mb-4">
          {w.meanings.map((m, i) => (
            <li key={i} className="text-sm text-slate-700">
              <span className="text-slate-400 mr-1">{i + 1}.</span>{m}
            </li>
          ))}
        </ul>
      ) : null}

      <TagRow label="Synonyms" tags={w.synonyms ?? []} color="blue" onDrilldown={onDrilldown} />
      <TagRow label="Antonyms" tags={w.antonyms ?? []} color="red" onDrilldown={onDrilldown} />
      <TagRow label="Collocations" tags={w.collocations ?? []} color="teal" onDrilldown={onDrilldown} />

      {(w.examples?.length ?? 0) > 0 && (
        <div className="mt-3 space-y-1.5">
          {w.examples.map((ex, i) => (
            <p key={i} className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-3">
              {ex}
            </p>
          ))}
        </div>
      )}
    </div>
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
  color: "blue" | "red" | "teal";
  onDrilldown: (tag: string) => void;
}) {
  if (!tags?.length) return null;

  const styles = {
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
    red:  "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
    teal: "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200",
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-xs text-slate-400 w-20 flex-shrink-0">{label}</span>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onDrilldown(tag)}
          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${styles[color]}`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
