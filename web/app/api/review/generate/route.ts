import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChat, groqChatJson, GroqRateLimitError } from "@/lib/groq";
import { DEFAULT_NATIVE_LANGUAGE, formatNativeLanguageForPrompt } from "@/lib/languages";

const SYSTEM =
  "You are an Australian English creative writing teacher and a professional English-to-Vietnamese translator. Your Vietnamese translations always read as natural, idiomatic Vietnamese written by a native speaker — never literal, word-for-word renderings.";

type StoryMode = "english" | "bilingual";
type StoryVariant = "fresh" | "paraphrase";

interface BilingualStoryRow {
  english: string;
  native: string;
}

function buildEnglishPrompt(words: string[], variant?: StoryVariant): string {
  const variantInstruction = variant
    ? `Make this a noticeably different version from any previous story, with a fresh situation and wording.\n`
    : "";

  return (
    `Write a natural, engaging story of about 250 words set in Australia that uses all of these words: ${words.join(", ")}\n\n` +
    variantInstruction +
    `Wrap each target word in the story with **word** markers (e.g. **reckon**).\n` +
    `The story should read naturally — don't force words awkwardly.\n` +
    `Return ONLY the story text, no JSON, no extra explanation.`
  );
}

function buildBilingualPrompt(words: string[], variant?: StoryVariant): string {
  const nativeLanguage = DEFAULT_NATIVE_LANGUAGE;
  const nativeLanguageLabel = formatNativeLanguageForPrompt(nativeLanguage);
  const variantInstruction = variant
    ? `Make this a noticeably different version from any previous story, with a fresh situation and wording.\n`
    : "";

  return (
    `Write a natural, engaging story set in Australia that uses all of these words: ${words.join(", ")}\n\n` +
    variantInstruction +
    `Return ONLY valid JSON, no markdown and no extra explanation:\n` +
    `{\n` +
    `  "mode": "bilingual",\n` +
    `  "rows": [\n` +
    `    { "english": "English story segment with **target** words marked.", "native": "Natural ${nativeLanguageLabel} translation of the same segment, with the translated word or phrase marked as **word**." }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Split the story into 4-7 rows.\n` +
    `- English rows together should be about 220-280 words.\n` +
    `- Wrap each target word in English with **word** markers.\n` +
    `- Translate each English row into natural, idiomatic ${nativeLanguageLabel} — write it the way a native speaker would actually say it, not a literal word-for-word translation. Reorder clauses, drop or add particles, and rephrase the whole sentence where needed so it reads smoothly.\n` +
    `- Before translating each target word, first work out what it actually means in THIS sentence (many English words are polysemous — e.g. "delicate" can mean fragile, subtle, or sensitive depending on context). Choose the ${nativeLanguageLabel} word a native speaker would naturally use for that specific contextual meaning, not the most common dictionary sense. Never produce a translation that sounds nonsensical in ${nativeLanguageLabel} even if it matches the English word literally.\n` +
    `- Every target word must be translated into its ${nativeLanguageLabel} meaning in context — never leave a target word in English in the native field.\n` +
    `- In the native field, wrap the translated word or phrase that corresponds to each target word with **word** markers, e.g. if "delicate" is translated as "mong manh", write "...không khí thật **mong manh**...".\n` +
    `- The story should read naturally — don't force words awkwardly.`
  );
}

function normalizeMode(mode: unknown): StoryMode {
  return mode === "bilingual" ? "bilingual" : "english";
}

function normalizeVariant(variant: unknown): StoryVariant | undefined {
  return variant === "fresh" || variant === "paraphrase" ? variant : undefined;
}

function normalizeBilingualRows(parsed: { rows?: BilingualStoryRow[] }): BilingualStoryRow[] {
  const rows = parsed.rows ?? [];

  return rows
    .filter((row) => typeof row?.english === "string" && typeof row?.native === "string")
    .map((row) => ({
      english: row.english.trim(),
      native: row.native.trim(),
    }))
    .filter((row) => row.english && row.native);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { words, mode: rawMode, variant: rawVariant } = await req.json();
  if (!words?.length) return NextResponse.json({ error: "Words are required" }, { status: 400 });
  const mode = normalizeMode(rawMode);
  const variant = normalizeVariant(rawVariant);

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set" }, { status: 422 });
  }

  let story = "";
  let rows: BilingualStoryRow[] = [];
  try {
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: mode === "bilingual" ? buildBilingualPrompt(words, variant) : buildEnglishPrompt(words, variant) },
    ];
    const opts = {
      max_tokens: mode === "bilingual" ? 1800 : 600,
      temperature: variant ? 0.9 : 0.8,
    };

    if (mode === "bilingual") {
      const parsed = await groqChatJson<{ rows?: BilingualStoryRow[] }>(apiKey, messages, opts);
      rows = normalizeBilingualRows(parsed);
      if (!rows.length) throw new Error("No bilingual rows returned");
    } else {
      story = await groqChat(apiKey, messages, opts);
    }
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("review/generate failed:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }

  const storedStory = mode === "bilingual" ? JSON.stringify({ mode, rows }) : story;
  const reviewSession = await prisma.reviewSession.create({
    data: {
      userId: session.user.id,
      words: JSON.stringify(words),
      story: storedStory,
    },
  });

  if (mode === "bilingual") {
    return NextResponse.json({ id: reviewSession.id, mode, rows, words });
  }

  return NextResponse.json({ id: reviewSession.id, mode, story, words });
}
