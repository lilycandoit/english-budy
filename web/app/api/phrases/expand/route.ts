import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChatJson, GroqRateLimitError } from "@/lib/groq";
import { DEFAULT_NATIVE_LANGUAGE, formatNativeLanguageForPrompt } from "@/lib/languages";

const SYSTEM = "You are an English phrase coach who helps learners sound natural in everyday conversation. Prioritize how native speakers actually talk over textbook or stiff phrasing.";

interface PhraseAlternative {
  text: string;
  tone: string;
  region: string;
  recommended: boolean;
  whenToUse: string;
  avoidWhen: string;
  example: string;
}

interface PhraseExpansion {
  phrase: string;
  meaning: string;
  alternatives: PhraseAlternative[];
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

// Normalizes both the new flat AI response shape and the old grouped shape
// (pre-redesign saved phrases: [{ label, items: [...] }]) into one flat list,
// so existing saved phrases keep rendering correctly without a DB migration.
function normalizeAlternativeItem(raw: unknown, fallbackTone = ""): PhraseAlternative {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    text: asString(obj.text),
    tone: asString(obj.tone, fallbackTone).toLowerCase(),
    region: asString(obj.region, "general"),
    recommended: obj.recommended === true,
    whenToUse: asString(obj.whenToUse),
    avoidWhen: asString(obj.avoidWhen),
    example: asString(obj.example),
  };
}

function normalizeAlternatives(raw: unknown): PhraseAlternative[] {
  if (!Array.isArray(raw) || !raw.length) return [];

  const first = raw[0] && typeof raw[0] === "object" ? raw[0] as Record<string, unknown> : {};
  const isOldGroupedShape = Array.isArray(first.items);

  const items = isOldGroupedShape
    ? (raw as Record<string, unknown>[]).flatMap((group) => {
        const label = asString(group.label);
        const groupItems = Array.isArray(group.items) ? group.items : [];
        return groupItems.map((item) => ({
          ...normalizeAlternativeItem(item, label),
          region: /australian/i.test(label) ? "Australian" : "general",
        }));
      })
    : raw.map((item) => normalizeAlternativeItem(item));

  return items.filter((item) => item.text && item.whenToUse);
}

function normalizeExpansion(parsed: unknown, phrase: string): PhraseExpansion {
  const obj = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};

  return {
    phrase: asString(obj.phrase, phrase),
    meaning: asString(obj.meaning),
    alternatives: normalizeAlternatives(obj.alternatives),
    notes: asStringArray(obj.notes),
    savedToWordBank: false,
  };
}

function buildWordInfo(expansion: PhraseExpansion) {
  const examples = expansion.alternatives
    .map((item) => item.example)
    .filter(Boolean)
    .slice(0, 5);

  return {
    kind: "phraseExpansion",
    word: expansion.phrase,
    ipa: "",
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
  const stored = info.phraseExpansion as unknown as Record<string, unknown>;
  return {
    phrase: asString(stored.phrase),
    meaning: asString(stored.meaning),
    alternatives: normalizeAlternatives(stored.alternatives),
    notes: asStringArray(stored.notes),
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
    `Teach this English phrase or expression to a ${nativeLanguageLabel} learner of English: "${phrase}"\n\n` +
    `Return ONLY valid JSON, no markdown and no extra explanation:\n` +
    `{\n` +
    `  "phrase": "${phrase}",\n` +
    `  "meaning": "Short plain-English meaning.",\n` +
    `  "alternatives": [\n` +
    `    { "text": "...", "tone": "casual|neutral|formal", "region": "general", "recommended": true, "whenToUse": "...", "avoidWhen": "...", "example": "..." }\n` +
    `  ],\n` +
    `  "notes": ["Useful fact or learner confusion note."]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Return 4-6 alternatives total. Every one must be a genuinely distinct, natural way native speakers actually say this — do not pad with stiff, textbook-sounding, or repetitive variations just to reach a count.\n` +
    `- tone: "casual", "neutral", or "formal" — pick whichever best fits each alternative.\n` +
    `- region: "general" for everyday English anyone would say; only use a specific region (e.g. "Australian") when a phrasing is genuinely distinct slang from that region. Do not force regional flavour — most alternatives should be "general".\n` +
    `- recommended: true on the 1-2 alternatives that are the most natural, most commonly used way to say this in everyday conversation. false on the rest.\n` +
    `- Every alternative needs whenToUse and a short natural example. avoidWhen can be an empty string if there's nothing important to avoid.\n` +
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
    const parsed = await groqChatJson<unknown>(
      apiKey,
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(input) },
      ],
      { max_tokens: 1500, temperature: 0.65 }
    );

    const expansion = normalizeExpansion(parsed, input);
    if (!expansion.alternatives.length) throw new Error("No alternatives returned");
    await saveToWordBank(session.user.id, expansion);
    return NextResponse.json({ ...expansion, savedToWordBank: true });
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
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
