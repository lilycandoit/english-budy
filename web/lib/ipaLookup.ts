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
