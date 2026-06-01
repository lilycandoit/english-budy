import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserGroqKey, groqChat, extractJson } from "@/lib/groq";

const SYSTEM = "You are an English writing coach. Help learners sound natural in Australian English.";

function buildPrompt(originalText: string, correctedText: string, currentNaturalText?: string | null): string {
  return (
    `Rewrite this sentence as a fluent native Australian English speaker would naturally say it.\n\n` +
    `Original learner sentence:\n"${originalText}"\n\n` +
    `Corrected sentence:\n"${correctedText}"\n\n` +
    (currentNaturalText
      ? `Current native rewrite to avoid repeating:\n"${currentNaturalText}"\n\n`
      : "") +
    `Return valid JSON only — no markdown, no extra text:\n` +
    `{"natural_text":"...","naturalness_tip":"..."}\n\n` +
    `Rules:\n` +
    `- Keep the same meaning.\n` +
    `- Make the new version noticeably different from the current native rewrite if one is provided.\n` +
    `- Use natural Australian English, contractions, and everyday phrasing where appropriate.\n` +
    `- naturalness_tip: one short practical note explaining what changed or why it sounds natural.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { originalText, correctedText, currentNaturalText } = await req.json();
  if (!originalText?.trim() || !correctedText?.trim()) {
    return NextResponse.json({ error: "Original and corrected text are required" }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set. Please add your key in settings." }, { status: 422 });
  }

  try {
    const raw = await groqChat(
      apiKey,
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: buildPrompt(
            originalText.trim(),
            correctedText.trim(),
            typeof currentNaturalText === "string" ? currentNaturalText.trim() : null
          ),
        },
      ],
      { max_tokens: 250, temperature: 0.85 }
    );

    const parsed = extractJson(raw) as { natural_text?: string; naturalness_tip?: string };
    return NextResponse.json({
      naturalText: parsed.natural_text ?? correctedText.trim(),
      naturalnessTip: parsed.naturalness_tip ?? null,
    });
  } catch {
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }
}
