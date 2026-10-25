import ipaDict from "@/lib/data/ipa-en-us.json";

const dict = ipaDict as Record<string, string[]>;

/**
 * Looks up a verified IPA transcription for a single English word from a
 * vendored dictionary (see lib/data/ipa-en-us.NOTICE.md). Returns null for
 * multi-word phrases/idioms and words not in the dictionary — callers should
 * fall back to the LLM-generated IPA in that case.
 */
export function lookupIpa(word: string): string | null {
  const key = word.trim().toLowerCase();
  if (!key || key.includes(" ")) return null;
  const pronunciations = dict[key];
  return pronunciations?.[0] ?? null;
}

/**
 * Simplifies a strict-IPA transcription to the looser notation most online
 * dictionaries and search engines display (e.g. Google, Merriam-Webster),
 * swapping linguistically-precise symbols for their everyday equivalents.
 * Purely a display transform — the underlying stored IPA is untouched.
 */
export function simplifyPhonetic(ipa: string): string {
  if (!ipa) return "";
  return ipa
    .replace(/ɹ/g, "r") // the English "r" sound (ɹ is precise, r is what people expect)
    .replace(/ɫ/g, "l"); // "dark l" (e.g. in "school") simplified to plain l
}
