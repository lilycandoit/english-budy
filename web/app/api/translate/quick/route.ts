import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserGroqKey, groqChatJson, GroqRateLimitError } from "@/lib/groq";
import { resolveNativeLanguage } from "@/lib/languages";

const MIN_SELECTION_CHARS = 2;
const MAX_SELECTION_CHARS = 200;

function buildSystemPrompt(nativeLanguageName: string): string {
  return `You are a professional English-to-${nativeLanguageName} translator helping a language learner understand a span of text they selected within a larger sentence. Your ${nativeLanguageName} translations always read as natural, idiomatic ${nativeLanguageName} written by a native speaker — never literal, word-for-word renderings.`;
}

function buildQuickPrompt(selection: string, context: string, nativeLanguageLabel: string): string {
  return (
    `Translate just the selected span into natural, idiomatic ${nativeLanguageLabel}, using the surrounding sentence to resolve its meaning in context:\n\n` +
    `Selected span: """${selection}"""\n` +
    `Surrounding sentence/context: """${context}"""\n\n` +
    `Return ONLY valid JSON, no markdown and no extra text:\n` +
    `{ "translation": "..." }\n\n` +
    `Rules:\n` +
    `- First work out what the selected span actually means in THIS context — words are often polysemous (e.g. "delicate" can mean fragile, subtle, or sensitive depending on context). Translate that specific contextual meaning, not just the most common dictionary sense.\n` +
    `- Write the translation the way a native speaker would naturally say it, not a stiff literal rendering.\n` +
    `- Keep it a short phrase matching the length/scope of the selected span — don't translate or restate the whole surrounding sentence unless the selected span IS the whole sentence.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { selection: rawSelection, context: rawContext } = await req.json();
  const selection = (rawSelection ?? "").trim();
  const context = (rawContext ?? "").trim();

  if (selection.length < MIN_SELECTION_CHARS || selection.length > MAX_SELECTION_CHARS) {
    return NextResponse.json({ error: "Selection must be between 2 and 200 characters" }, { status: 400 });
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
      { role: "user", content: buildQuickPrompt(selection, context || selection, nativeLanguageLabel) },
    ];
    const parsed = await groqChatJson<{ translation?: string }>(apiKey, messages, {
      model: "openai/gpt-oss-20b",
      reasoning_effort: "low",
      temperature: 0.3,
      max_tokens: 200,
    });
    const translation = (parsed.translation ?? "").trim();
    if (!translation) throw new Error("No translation returned");
    return NextResponse.json({ translation });
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("translate/quick failed:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }
}
