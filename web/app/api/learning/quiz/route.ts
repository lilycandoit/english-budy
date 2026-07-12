import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChatJson, GroqRateLimitError } from "@/lib/groq";

const SYSTEM = "You are an English vocabulary teacher for Australian learners. Always respond with valid JSON only.";

function buildQuizPrompt(words: string[], wordInfos: unknown[]): string {
  return (
    `Generate a 5-question vocabulary quiz for these saved word entries.\n\n` +
    `Words: ${words.join(", ")}\n\n` +
    `Word info JSON:\n${JSON.stringify(wordInfos)}\n\n` +
    `Return ONLY valid JSON — no markdown, no extra text:\n` +
    `{\n` +
    `  "quiz": [\n` +
    `    {\n` +
    `      "question": "What does 'sanction' mean as a noun?",\n` +
    `      "options": ["option A", "option B", "option C", "option D"],\n` +
    `      "answer": "option A",\n` +
    `      "explanation": "Explanation of why this answer is correct.",\n` +
    `      "word": "sanction"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Generate exactly 5 quiz questions across the words/phrases.\n` +
    `- Each quiz question must have exactly 4 options.\n` +
    `- The "answer" field must exactly match one of the options.\n` +
    `- The "explanation" field must be 1-2 short sentences.\n` +
    `- Keep questions practical for Australian English learners.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Session ID is required" }, { status: 400 });

  const learningSession = await prisma.learningSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  });

  if (!learningSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const existingQuiz = JSON.parse(learningSession.quiz ?? "[]");
  if (Array.isArray(existingQuiz) && existingQuiz.length > 0) {
    return NextResponse.json({ quiz: existingQuiz });
  }

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set" }, { status: 422 });
  }

  const words = JSON.parse(learningSession.words) as string[];
  const wordInfos = JSON.parse(learningSession.wordInfo) as unknown[];

  try {
    const parsed = await groqChatJson<{ quiz?: unknown[] }>(
      apiKey,
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildQuizPrompt(words, wordInfos) },
      ],
      { max_tokens: 900, temperature: 0.5 }
    );
    const quiz = parsed.quiz ?? [];

    await prisma.learningSession.update({
      where: { id: learningSession.id },
      data: { quiz: JSON.stringify(quiz) },
    });

    return NextResponse.json({ quiz });
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json({ error: "Quiz generation failed. Please try again." }, { status: 502 });
  }
}
