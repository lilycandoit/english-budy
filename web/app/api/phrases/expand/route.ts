import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChat, extractJson } from "@/lib/groq";
import { DEFAULT_NATIVE_LANGUAGE, formatNativeLanguageForPrompt } from "@/lib/languages";

const SYSTEM = "You are an Australian English phrase coach. Teach practical alternatives with clear tone and usage guidance.";

interface PhraseAlternative {
  text: string;
  tone: string;
  whenToUse: string;
  avoidWhen: string;
  example: string;
}

interface PhraseAlternativeGroup {
  label: string;
  description: string;
  items: PhraseAlternative[];
}

interface PhraseExpansion {
  phrase: string;
  meaning: string;
  alternatives: PhraseAlternativeGroup[];
  notes: string[];
  savedToWordBank: boolean;
  cached?: boolean;
}

interface PhraseWordInfo {
  kind?: string;
  phraseExpansion?: PhraseExpansion;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : [];
}

function normalizeExpansion(parsed: unknown, phrase: string): PhraseExpansion {
  const obj = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const rawAlternatives = Array.isArray(obj.alternatives) ? obj.alternatives : [];
  const alternatives = rawAlternatives
    .map((group) => {
      const groupObj = group && typeof group === "object" ? group as Record<string, unknown> : {};
      const rawItems = Array.isArray(groupObj.items) ? groupObj.items : [];
      const items = rawItems
        .map((item) => {
          const itemObj = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            text: asString(itemObj.text),
            tone: asString(itemObj.tone),
            whenToUse: asString(itemObj.whenToUse),
            avoidWhen: asString(itemObj.avoidWhen),
            example: asString(itemObj.example),
          };
        })
        .filter((item) => item.text && item.whenToUse);

      return {
        label: asString(groupObj.label),
        description: asString(groupObj.description),
        items,
      };
    })
    .filter((group) => group.label && group.items.length);

  return {
    phrase: asString(obj.phrase, phrase),
    meaning: asString(obj.meaning),
    alternatives,
    notes: asStringArray(obj.notes),
    savedToWordBank: false,
  };
}

function flattenAlternatives(expansion: PhraseExpansion): PhraseAlternative[] {
  return expansion.alternatives.flatMap((group) => group.items);
}

function buildWordInfo(expansion: PhraseExpansion) {
  const alternatives = flattenAlternatives(expansion);
  const examples = alternatives
    .map((item) => item.example)
    .filter(Boolean)
    .slice(0, 5);

  return {
    kind: "phraseExpansion",
    word: expansion.phrase,
    ipa: "",
    stress: "",
    forms: [
      {
        pos: "phrase",
        inflections: "phrase expansion",
        meanings: [expansion.meaning].filter(Boolean),
      },
    ],
    synonyms: [],
    antonyms: [],
    collocations: [],
    examples,
    phraseExpansion: { ...expansion, savedToWordBank: true },
  };
}

function getCachedExpansion(wordInfo: unknown): PhraseExpansion | null {
  if (!wordInfo || typeof wordInfo !== "object") return null;
  const info = wordInfo as PhraseWordInfo;
  if (info.kind !== "phraseExpansion" && !info.phraseExpansion) return null;
  if (!info.phraseExpansion) return null;
  return {
    ...info.phraseExpansion,
    savedToWordBank: true,
    cached: true,
  };
}

async function findCachedExpansion(userId: string, phrase: string) {
  const entry = await prisma.wordEntry.findUnique({
    where: { userId_word: { userId, word: phrase.toLowerCase() } },
  });
  if (!entry) return null;

  try {
    return getCachedExpansion(JSON.parse(entry.wordInfo));
  } catch {
    return null;
  }
}

async function saveToWordBank(userId: string, expansion: PhraseExpansion) {
  const wordInfo = buildWordInfo(expansion);
  await prisma.wordEntry.upsert({
    where: { userId_word: { userId, word: expansion.phrase.toLowerCase() } },
    update: { wordInfo: JSON.stringify(wordInfo) },
    create: {
      userId,
      word: expansion.phrase.toLowerCase(),
      wordInfo: JSON.stringify(wordInfo),
    },
  });

  const count = await prisma.wordEntry.count({ where: { userId } });
  if (count > 200) {
    const oldest = await prisma.wordEntry.findMany({
      where: { userId },
      orderBy: { updatedAt: "asc" },
      take: count - 200,
      select: { id: true },
    });
    await prisma.wordEntry.deleteMany({ where: { id: { in: oldest.map((entry) => entry.id) } } });
  }
}

function buildPrompt(phrase: string): string {
  const nativeLanguageLabel = formatNativeLanguageForPrompt(DEFAULT_NATIVE_LANGUAGE);

  return (
    `Teach this English phrase or expression to a Vietnamese learner of Australian English: "${phrase}"\n\n` +
    `Return ONLY valid JSON, no markdown and no extra explanation:\n` +
    `{\n` +
    `  "phrase": "${phrase}",\n` +
    `  "meaning": "Short plain-English meaning.",\n` +
    `  "alternatives": [\n` +
    `    { "label": "Casual", "description": "When this group sounds natural.", "items": [] },\n` +
    `    { "label": "Neutral", "description": "When this group sounds natural.", "items": [] },\n` +
    `    { "label": "Professional", "description": "When this group sounds natural.", "items": [] },\n` +
    `    { "label": "Softer", "description": "When this group sounds natural.", "items": [] },\n` +
    `    { "label": "Australian English", "description": "When this group sounds natural.", "items": [] }\n` +
    `  ],\n` +
    `  "notes": ["Useful fact, Australian usage note, or learner warning."]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Return exactly these 5 groups in this order: Casual, Neutral, Professional, Softer, Australian English (if available).\n` +
    `- Each group should include 2-5 alternatives. Do not put most alternatives in only one group.\n` +
    `- Every alternative item must include text, tone, whenToUse, avoidWhen, and example.\n` +
    `- Keep examples short and natural.\n` +
    `- Mention ${nativeLanguageLabel} only in notes when it helps explain a common learner confusion.\n` +
    `- Do not create a long essay.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phrase } = await req.json();
  const input = typeof phrase === "string" ? phrase.trim() : "";
  if (!input) return NextResponse.json({ error: "Phrase is required" }, { status: 400 });
  if (input.length > 120) return NextResponse.json({ error: "Please enter one shorter phrase" }, { status: 400 });

  const cached = await findCachedExpansion(session.user.id, input);
  if (cached) return NextResponse.json(cached);

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
        { role: "user", content: buildPrompt(input) },
      ],
      { max_tokens: 3000, temperature: 0.65 }
    );

    const expansion = normalizeExpansion(extractJson(raw), input);
    if (!expansion.alternatives.length) throw new Error("No alternatives returned");
    await saveToWordBank(session.user.id, expansion);
    return NextResponse.json({ ...expansion, savedToWordBank: true });
  } catch {
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.wordEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    entries: entries.flatMap((entry) => {
      try {
        const expansion = getCachedExpansion(JSON.parse(entry.wordInfo));
        if (!expansion) return [];
        return [{
          id: entry.id,
          phrase: entry.word,
          updatedAt: entry.updatedAt,
          expansion,
        }];
      } catch {
        return [];
      }
    }),
  });
}
