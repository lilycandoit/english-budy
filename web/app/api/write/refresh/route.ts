import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserGroqKey, groqChatJson, GroqRateLimitError } from "@/lib/groq";
import { resolveNativeLanguage } from "@/lib/languages";

// Keep in sync with components/tabs/Writing.tsx's MAX_INPUT_CHARS.
const MAX_INPUT_CHARS = 500;

function buildSystemPrompt(nativeLanguageName: string): string {
  return `You are an English writing coach helping a learner who thinks in ${nativeLanguageName} but wants to say it naturally in English. Help them sound like a fluent native Australian English speaker, and teach them something real about the language along the way.`;
}

function buildRefreshPrompt(nativeText: string, currentEnglishText: string, nativeLanguageLabel: string): string {
  return (
    `The learner wants to say something in English but can currently only express it in ${nativeLanguageLabel}. Here is what they wrote:\n\n"${nativeText}"\n\n` +
    `Current English version to avoid repeating:\n"${currentEnglishText}"\n\n` +
    `Return valid JSON only — no markdown, no extra text:\n` +
    `{"english":"...","tip":"..."}\n\n` +
    `Rules:\n` +
    `- "english": compose a DIFFERENT natural, fluent English version of the same meaning — noticeably different wording/structure from the current version above, as a native English speaker would actually say it. Preserve the meaning and intent.\n` +
    `- "tip": exactly one short, genuinely useful teaching note about something in THIS new composed sentence — a slang term, an idiom, why a particular tense or structure was used, a natural collocation, or similar. Specific to this sentence, not a generic platitude.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nativeText: rawText, currentEnglishText: rawCurrent } = await req.json();
  const nativeText = (rawText ?? "").trim();
  const currentEnglishText = (rawCurrent ?? "").trim();
  if (!nativeText) return NextResponse.json({ error: "Text is required" }, { status: 400 });
  if (nativeText.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Text is too long (${nativeText.length} characters). Keep it under ${MAX_INPUT_CHARS} characters.` },
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

  try {
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: buildSystemPrompt(nativeLanguageLabel) },
      { role: "user", content: buildRefreshPrompt(nativeText, currentEnglishText, nativeLanguageLabel) },
    ];
    const parsed = await groqChatJson<{ english?: string; tip?: string }>(apiKey, messages, {
      model: "openai/gpt-oss-20b",
      reasoning_effort: "low",
      temperature: 0.85,
      max_tokens: Math.min(350 + Math.ceil(nativeText.length * 1.2), 900),
    });
    const english = (parsed.english ?? "").trim();
    const tip = (parsed.tip ?? "").trim();
    if (!english) throw new Error("No English composition returned");
    return NextResponse.json({ englishText: english, tip });
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("write/refresh failed:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }
}
