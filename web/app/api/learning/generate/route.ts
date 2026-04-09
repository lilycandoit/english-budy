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
    `      "word": "sanction",\n` +
    `      "ipa": "/ˈsæŋkʃən/",\n` +
    `      "stress": "SANK-shun",\n` +
    `      "forms": [\n` +
    `        {\n` +
    `          "pos": "noun",\n` +
    `          "inflections": "plural: sanctions",\n` +
    `          "meanings": ["a threatened penalty for disobeying a law or rule", "official permission or approval for an action"]\n` +
    `        },\n` +
    `        {\n` +
    `          "pos": "verb",\n` +
    `          "inflections": "sanctions / sanctioned / sanctioned / sanctioning",\n` +
    `          "meanings": ["give official permission or approval for", "impose a penalty on"]\n` +
    `        }\n` +
    `      ],\n` +
    `      "synonyms": ["penalty", "punishment", "embargo", "authorization", "approval", "consent", "permit", "restriction"],\n` +
    `      "antonyms": ["reward", "incentive", "disapproval", "prohibition"],\n` +
    `      "collocations": ["impose sanctions", "lift sanctions", "economic sanctions", "trade sanctions", "international sanctions", "sanction a deal", "UN sanctions", "face sanctions"],\n` +
    `      "examples": [\n` +
    `        "The government decided to impose sanctions on the country for its human rights abuses.",\n` +
    `        "The school sanctioned the new policy after consulting with parents.",\n` +
    `        "Trade sanctions were lifted once the country agreed to the terms.",\n` +
    `        "The committee needs to sanction the budget before we can proceed."\n` +
    `      ]\n` +
    `    }\n` +
    `  ],\n` +
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
    `- Determine if each input is a SINGLE WORD or a PHRASE/SLANG/IDIOM (2+ words or a fixed expression like "fair dinkum", "kick the bucket", "no worries").\n` +
    `\n` +
    `If it is a SINGLE WORD:\n` +
    `- ALWAYS use the base/lemma form for "word" — convert any inflected form to its base (e.g. "sanctions" → "sanction", "sang" → "sing", "running" → "run")\n` +
    `- For "forms": include every applicable part of speech (noun, verb, adjective, adverb)\n` +
    `  - noun: inflections = "plural: <form>" (or "uncountable" if applicable)\n` +
    `  - verb: inflections = "<3rd-person> / <past> / <past-participle> / <present-participle>" (e.g. "sings / sang / sung / singing")\n` +
    `  - adjective: inflections = "comparative: <form>, superlative: <form>" (or "invariable" if it doesn't inflect)\n` +
    `  - adverb: inflections = "invariable"\n` +
    `  - Each form must have 1–3 distinct meanings for that part of speech\n` +
    `\n` +
    `If it is a PHRASE, SLANG, or IDIOM:\n` +
    `- Keep "word" as the exact phrase (normalised but not split), e.g. "fair dinkum", "kick the bucket"\n` +
    `- Use a single entry in "forms" with pos = "phrase", "idiom", or "slang" (pick the most accurate)\n` +
    `- Set "inflections" to the register + origin, e.g. "informal · Australian slang" or "idiomatic · origin: 19th century"\n` +
    `- "meanings" should explain the phrase as a whole (do NOT define individual words)\n` +
    `- synonyms: equivalent expressions or phrases (4–6)\n` +
    `- antonyms: opposite-meaning phrases if applicable, otherwise []\n` +
    `- collocations: common contexts or sentence frames where the phrase is used (6–8)\n` +
    `\n` +
    `For ALL inputs:\n` +
    `- Include ALL ${words.length} word(s)/phrase(s) in the words array\n` +
    `- synonyms: 6–8 items\n` +
    `- antonyms: 4–6 items (empty array [] if none apply)\n` +
    `- collocations: 8–10 natural phrases or collocations\n` +
    `- examples: 4–5 sentences using everyday Australian English (reckon, keen, arvo, no worries, mate, etc. where natural)\n` +
    `- Generate exactly 5 quiz questions across the words/phrases\n` +
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
      { max_tokens: Math.min(500 + words.length * 700, 6000), temperature: 0.7 }
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
