import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChatJson, GroqRateLimitError } from "@/lib/groq";
import { resolveNativeLanguage } from "@/lib/languages";

// Keep in sync with components/tabs/Translating.tsx's MAX_INPUT_CHARS.
const MAX_INPUT_CHARS = 2000;

interface TranslationRow {
  english: string;
  native: string;
}

function buildSystemPrompt(nativeLanguageName: string): string {
  return `You are a professional English-to-${nativeLanguageName} translator helping a language learner understand text they encountered (a sentence, a comment, a transcript line). Your ${nativeLanguageName} translations always read as natural, idiomatic ${nativeLanguageName} written by a native speaker — never literal, word-for-word renderings.`;
}

function buildTranslatePrompt(text: string, nativeLanguageLabel: string): string {
  return (
    `Translate the following text in context for an English learner:\n\n"""\n${text}\n"""\n\n` +
    `Return ONLY valid JSON, no markdown and no extra explanation:\n` +
    `{\n` +
    `  "rows": [\n` +
    `    { "english": "A segment of the original text, reproduced exactly.", "native": "Natural ${nativeLanguageLabel} translation of that segment." }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Split the text into natural rows by sentence, clause, or short-paragraph breakpoints. Don't fragment a single short line into multiple tiny rows; don't under-split a multi-paragraph block into one giant row.\n` +
    `- The "english" field must reproduce that row's portion of the ORIGINAL text EXACTLY — same wording, spelling, capitalization, and punctuation, even if informal, slangy, or containing typos or grammar mistakes. This is a translation, not a correction — never fix, clean up, or paraphrase the English text.\n` +
    `- Every row's "english" segments, concatenated in order, must reconstruct the original text with nothing added, removed, or reworded.\n` +
    `- Before translating each row, first work out what it actually means in context (words are often polysemous — e.g. "delicate" can mean fragile, subtle, or sensitive depending on context). Choose the ${nativeLanguageLabel} wording a native speaker would naturally use for that specific contextual meaning, not just the most common dictionary sense.\n` +
    `- Translate into natural, idiomatic ${nativeLanguageLabel} — write it the way a native speaker would actually say it. Reorder clauses, drop or add particles, and rephrase where needed so it reads smoothly. Never produce a translation that sounds nonsensical in ${nativeLanguageLabel} even if it matches the English literally.\n` +
    `- Never leave a row's "native" field in English.`
  );
}

function normalizeRows(parsed: { rows?: TranslationRow[] }): TranslationRow[] {
  const rows = parsed.rows ?? [];
  return rows
    .filter((row) => typeof row?.english === "string" && typeof row?.native === "string")
    .map((row) => ({ english: row.english.trim(), native: row.native.trim() }))
    .filter((row) => row.english && row.native);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text: rawText } = await req.json();
  const text = (rawText ?? "").trim();
  if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Text is too long (${text.length} characters). Keep it under ${MAX_INPUT_CHARS} characters.` },
      { status: 400 }
    );
  }

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set" }, { status: 422 });
  }

  const nativeLanguageLabel = resolveNativeLanguage(session.user.nativeLanguage);

  let rows: TranslationRow[] = [];
  try {
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: buildSystemPrompt(nativeLanguageLabel) },
      { role: "user", content: buildTranslatePrompt(text, nativeLanguageLabel) },
    ];
    const parsed = await groqChatJson<{ rows?: TranslationRow[] }>(apiKey, messages, {
      model: "openai/gpt-oss-20b",
      reasoning_effort: "low",
      temperature: 0.3,
      max_tokens: Math.min(600 + Math.ceil(text.length * 0.9), 3200),
    });
    rows = normalizeRows(parsed);
    if (!rows.length) throw new Error("No translation rows returned");
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("translate/generate failed:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }

  const entry = await prisma.translationEntry.create({
    data: {
      userId: session.user.id,
      sourceText: text,
      rows: JSON.stringify(rows),
    },
  });

  return NextResponse.json({ id: entry.id, rows });
}
