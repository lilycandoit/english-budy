export const SUPPORTED_NATIVE_LANGUAGES = {
  vi: {
    code: "vi",
    englishName: "Vietnamese",
    nativeName: "Tiếng Việt",
  },
} as const;

export type NativeLanguageCode = keyof typeof SUPPORTED_NATIVE_LANGUAGES;

export type NativeLanguage = (typeof SUPPORTED_NATIVE_LANGUAGES)[NativeLanguageCode];

export const DEFAULT_NATIVE_LANGUAGE: NativeLanguage = SUPPORTED_NATIVE_LANGUAGES.vi;

export function getNativeLanguage(code: NativeLanguageCode = DEFAULT_NATIVE_LANGUAGE.code): NativeLanguage {
  return SUPPORTED_NATIVE_LANGUAGES[code];
}

export function formatNativeLanguageForPrompt(language: NativeLanguage = DEFAULT_NATIVE_LANGUAGE): string {
  return `${language.englishName} (${language.nativeName})`;
}
