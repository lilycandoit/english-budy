import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChat, extractJson } from "@/lib/groq";

const SYSTEM = "You are an English writing coach. Help learners improve both accuracy and naturalness.";

function buildPrompt(text: string): string {
  return (
    `Check this sentence and respond in valid JSON only — no markdown, no extra text:\n"${text}"\n\n` +
    `Return exactly this structure:\n` +
    `{"corrected_text":"...","natural_text":"...","mistake_type":"grammar|spelling|punctuation|none","explanation":"...","naturalness_tip":"..."}\n\n` +
    `Rules:\n` +
    `- corrected_text: fix only grammar/spelling/punctuation errors, keep the same meaning and words\n` +
    `- natural_text: rewrite as a fluent native Australian English speaker would naturally say it\n` +
    `- mistake_type: the primary error type, or "none" if the sentence is already correct\n` +
    `- explanation: brief explanation of grammar/spelling changes (or "Looks good!" if none)\n` +
    `- naturalness_tip: one practical tip on how to sound more natural (null if already natural)`
  );
}

// POST /api/mistakes — submit a sentence for correction
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set. Please add your key in settings." }, { status: 422 });
  }

  let correctedText = text.trim();
  let naturalText = text.trim();
  let mistakeType = "none";
  let explanation = "Looks good!";
  let naturalnessTip: string | null = null;

  try {
    const raw = await groqChat(
      apiKey,
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(text.trim()) },
      ],
      { max_tokens: 300, temperature: 0.2 }
    );

    const parsed = extractJson(raw) as Record<string, string>;
    correctedText = parsed.corrected_text ?? correctedText;
    naturalText = parsed.natural_text ?? naturalText;
    mistakeType = parsed.mistake_type ?? mistakeType;
    explanation = parsed.explanation ?? explanation;
    naturalnessTip = parsed.naturalness_tip ?? null;
  } catch {
    // AI failed — save the original as "no correction" rather than blocking the user
  }

  const mistake = await prisma.mistake.create({
    data: {
      userId: session.user.id,
      originalText: text.trim(),
      correctedText,
      naturalText,
      mistakeType,
      explanation,
      naturalnessTip,
    },
  });

  return NextResponse.json(mistake, { status: 201 });
}

// GET /api/mistakes — fetch history (optional ?type=grammar)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");

  const mistakes = await prisma.mistake.findMany({
    where: {
      userId: session.user.id,
      ...(type && type !== "all" ? { mistakeType: type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(mistakes);
}
