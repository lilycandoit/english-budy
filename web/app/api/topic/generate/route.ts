import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChat, extractJson } from "@/lib/groq";

const SYSTEM = "You are an English teacher. Always respond with valid JSON only.";

type BaseFormat = "dialog" | "story";
type Level = "everyday" | "natural" | "advanced";

function buildPrompt(
  topic: string,
  baseFormat: BaseFormat,
  level: Level,
  aussieMode: boolean,
  excludedPhrases: string[]
): string {
  // ── Content instruction ──────────────────────────────────────────────────
  let contentInstruction: string;
  if (baseFormat === "dialog") {
    const speakers = aussieMode
      ? "two Australians called Alex and Sam"
      : "two people called Alex and Sam";
    contentInstruction =
      `Write a natural, friendly conversation between ${speakers} about: ${topic}\n\n` +
      `IMPORTANT: Format as a proper dialogue with EACH speaker on its own line:\n` +
      `Alex: [what Alex says]\n` +
      `Sam: [what Sam says]\n` +
      `Alex: [reply]\n` +
      `Sam: [reply]\n` +
      `...and so on. At least 8 exchanges. Every speaker turn MUST be on a separate line starting with "Alex:" or "Sam:".`;
  } else {
    contentInstruction =
      `Write a natural, engaging third-person story of about 280 words about: ${topic}`;
  }

  // ── Level instruction ────────────────────────────────────────────────────
  const levelInstruction = {
    everyday:
      "Use common, clear expressions that an intermediate English learner would immediately benefit from.",
    natural:
      "Use a richer, more varied range of expressions beyond common ESL textbook phrases. " +
      "Include idiomatic language, less-predictable phrasal verbs, and expressions that educated native speakers naturally use in everyday conversation. " +
      "Avoid the most overused ESL phrases like 'figure out', 'take a look', 'get used to'.",
    advanced:
      "Use sophisticated, nuanced language. Include advanced vocabulary, complex idiomatic expressions, " +
      "colourful figures of speech, and varied sentence structures that challenge an upper-intermediate to advanced learner. " +
      "Avoid basic or common phrasal verbs.",
  }[level];

  // ── Aussie flavour instruction ───────────────────────────────────────────
  const aussieInstruction = aussieMode
    ? "Naturally weave in genuine Australian expressions and everyday Aussie slang — the kind real Sydneysiders actually use."
    : "Use clear standard English — no Australian slang.";

  // ── Word selection ───────────────────────────────────────────────────────
  const wordInstruction =
    `Mark ALL useful words and expressions in the content with **word** markers. ` +
    `Aim to highlight 15–25 expressions for a dialog, 12–18 for a story — mark every phrase worth learning.\n` +
    `Pick a varied mix: topic-specific vocabulary (genuinely needed to discuss ${topic}), ` +
    `phrasal verbs, idioms, collocations, and natural expressions.\n` +
    `${levelInstruction}\n` +
    `${aussieInstruction}`;

  // ── Exclusion list ───────────────────────────────────────────────────────
  const exclusionInstruction =
    excludedPhrases.length > 0
      ? `\nIMPORTANT — The following words/phrases have already been taught. Do NOT use any of them ` +
        `in your vocabulary list or wrap them with ** markers: ${excludedPhrases.join(", ")}.\n` +
        `Choose entirely fresh vocabulary that hasn't been covered before.`
      : "";

  return (
    `${contentInstruction}\n\n` +
    `${wordInstruction}${exclusionInstruction}\n\n` +
    `Wrap each target word/phrase in the content with **word** markers (e.g. **figure out**).\n\n` +
    `Return ONLY valid JSON — no markdown, no extra text:\n` +
    `{\n` +
    `  "title": "Short catchy title",\n` +
    `  "content": "Full content with **target words** wrapped",\n` +
    `  "words": [\n` +
    `    {"word": "figure out", "meaning": "to understand or solve something", "example": "I need to figure out what to do next."}\n` +
    `  ]\n` +
    `}\n\n` +
    `The words array must include an entry for EVERY word/phrase you marked with ** in the content — no omissions.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    topic,
    format = "dialog",
    level = "everyday",
    aussieMode = false,
    excludedPhrases = [],
  } = await req.json();

  if (!topic?.trim()) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

  const baseFormat: BaseFormat = (format as string).replace("-aussie", "") as BaseFormat;
  const storedFormat = aussieMode ? `${baseFormat}-aussie` : baseFormat;

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set" }, { status: 422 });
  }

  let title = topic;
  let content = "";
  let words: { word: string; meaning: string; example: string }[] = [];

  let raw = "";
  try {
    raw = await groqChat(
      apiKey,
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(topic.trim(), baseFormat, level as Level, aussieMode, excludedPhrases) },
      ],
      { max_tokens: 2000, temperature: 0.85 }
    );
  } catch (err) {
    console.error("[topic/generate] Groq API error:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }

  try {
    const parsed = extractJson(raw) as { title: string; content: string; words: typeof words };
    title = parsed.title ?? topic;
    content = (parsed.content ?? "").replace(/(?<!\n)\s+(Alex|Sam):/g, "\n$1:");
    words = (parsed.words ?? []).map((w) => ({
      ...w,
      word: w.word.replace(/\*\*/g, "").trim(),
      example: (w.example ?? "").replace(/\*\*/g, "").trim(),
    }));
  } catch (err) {
    console.error("[topic/generate] JSON parse error. Raw response:\n", raw);
    console.error(err);
    return NextResponse.json({ error: "AI returned an unexpected response. Please try again." }, { status: 502 });
  }

  const topicSession = await prisma.topicSession.create({
    data: {
      userId: session.user.id,
      topic: topic.trim(),
      format: storedFormat,
      level: level as string,
      title,
      content,
      words: JSON.stringify(words),
    },
  });

  return NextResponse.json({ id: topicSession.id, title, content, words, format: storedFormat, level });
}
