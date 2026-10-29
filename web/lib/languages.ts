export const DEFAULT_NATIVE_LANGUAGE_NAME = "Vietnamese";

// Shown as <datalist> suggestions in Settings — convenience only, any text is accepted.
export const COMMON_LANGUAGE_SUGGESTIONS = [
  "Vietnamese",
  "Spanish",
  "Mandarin Chinese",
  "Korean",
  "Japanese",
  "Portuguese",
  "Hindi",
  "Arabic",
  "French",
  "Thai",
];

export function resolveNativeLanguage(nativeLanguage?: string | null): string {
  return nativeLanguage?.trim() || DEFAULT_NATIVE_LANGUAGE_NAME;
}
