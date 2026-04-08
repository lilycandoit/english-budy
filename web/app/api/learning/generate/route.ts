import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChat, extractJson } from "@/lib/groq";

const SYSTEM = "You are an English vocabulary teacher for Australian learners. Always respond with valid JSON only.";

function buildPrompt(words: string[]): string {
  return (
    `Generate a vocabulary lesson for these word(s): ${words.join(", ")}\n\n` +
    `Return ONLY valid JSON — no markdown, no extra text:\n` +
    `{\n` +
    `  "words": [\n` +
    `    {\n` +
    `      "word": "example",\n` +
    `      "ipa": "/ɪɡˈzɑːmpəl/",\n` +
    `      "stress": "ex-AM-ple",\n` +
    `      "meanings": ["primary meaning", "secondary meaning"],\n` +
    `      "synonyms": ["word1", "word2", "word3"],\n` +
    `      "antonyms": ["word1", "word2", "word3"],\n` +
    `      "collocations": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"],\n` +
    `      "examples": ["Australian English example sentence 1.", "Australian English example sentence 2."]\n` +
    `    }\n` +
    `  ],\n` +
    `  "quiz": [\n` +
    `    {\n` +
    `      "question": "What does 'example' mean?",\n` +
    `      "options": ["option A", "option B", "option C", "option D"],\n` +
    `      "answer": "option A",\n` +
    `      "explanation": "Explanation of why this answer is correct and what the word means in context.",\n` +
    `      "word": "example"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Include ALL ${words.length} word(s) in the words array\n` +
    `- Use everyday Australian English in example sentences (reckon, keen, arvo, no worries, etc. where natural)\n` +
    `- Generate exactly 5 quiz questions across the words\n` +
    `- Each quiz question must have exactly 4 options\n` +
    `- The "answer" field must exactly match one of the options\n` +
    `- The "explanation" field: 1-2 sentences explaining why the correct answer is right`
  );
}

async function upsertWordBank(userId: string, wordInfos: { word: string; [key: string]: unknown }[]) {
  for (const w of wordInfos) {
    await prisma.wordEntry.upsert({
      where: { userId_word: { userId, word: w.word.toLowerCase() } },
      update: { wordInfo: JSON.stringify(w) },
      create: { userId, word: w.word.toLowerCase(), wordInfo: JSON.stringify(w) },
    });
  }
  // Enforce 200-word cap — delete oldest if over
  const count = await prisma.wordEntry.count({ where: { userId } });
  if (count > 200) {
    const oldest = await prisma.wordEntry.findMany({
      where: { userId },
      orderBy: { updatedAt: "asc" },
      take: count - 200,
      select: { id: true },
    });
    await prisma.wordEntry.deleteMany({ where: { id: { in: oldest.map((e) => e.id) } } });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { words: rawWords } = await req.json();
  if (!rawWords?.trim()) return NextResponse.json({ error: "Words are required" }, { status: 400 });

  const words = (rawWords as string)
    .split(",")
    .map((w: string) => w.trim())
    .filter(Boolean)
    .slice(0, 8); // max 8 words per session

  if (!words.length) return NextResponse.json({ error: "No valid words found" }, { status: 400 });

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set" }, { status: 422 });
  }

  let wordInfos: unknown[] = [];
  let quiz: unknown[] = [];

  try {
    const raw = await groqChat(
      apiKey,
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(words) },
      ],
      { max_tokens: 1500, temperature: 0.7 }
    );
    const parsed = extractJson(raw) as { words: unknown[]; quiz: unknown[] };
    wordInfos = parsed.words ?? [];
    quiz = parsed.quiz ?? [];
  } catch (err) {
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }

  // Save session
  const learningSession = await prisma.learningSession.create({
    data: {
      userId: session.user.id,
      words: JSON.stringify(words),
      wordInfo: JSON.stringify(wordInfos),
      quiz: JSON.stringify(quiz),
    },
  });

  // Upsert word bank
  await upsertWordBank(session.user.id, wordInfos as { word: string; [key: string]: unknown }[]);

  return NextResponse.json({
    sessionId: learningSession.id,
    words: wordInfos,
    quiz,
  });
}
