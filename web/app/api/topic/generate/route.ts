import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChat, extractJson } from "@/lib/groq";

const SYSTEM = "You are an English teacher. Always respond with valid JSON only.";

function buildPrompt(topic: string, format: "dialog" | "story" | "aussie"): string {
  let contentInstruction: string;
  let wordInstruction: string;

  if (format === "dialog") {
    contentInstruction =
      `Write a natural, friendly conversation between two people called Alex and Sam about: ${topic}\n\n` +
      `IMPORTANT: Format as a proper dialogue with EACH speaker on its own line:\n` +
      `Alex: [what Alex says]\n` +
      `Sam: [what Sam says]\n` +
      `Alex: [reply]\n` +
      `Sam: [reply]\n` +
      `...and so on. At least 8 exchanges. Every speaker turn MUST be on a separate line starting with "Alex:" or "Sam:".`;
    wordInstruction =
      `Choose exactly 12 words or phrases that appear naturally in the conversation above.\n` +
      `Pick a mix of topic-specific vocabulary (the kind of words you genuinely need to discuss ${topic}) and natural conversational expressions.\n` +
      `Select words that are genuinely useful and varied — nouns, verbs, adjectives, phrasal verbs, idioms. Do not force or repeat the same common phrases every time.\n` +
      `Use clear standard English — no Australian slang.`;
  } else if (format === "story") {
    contentInstruction =
      `Write a natural, engaging third-person story of about 280 words about: ${topic}`;
    wordInstruction =
      `Choose exactly 12 words or phrases that appear naturally in the story above.\n` +
      `Pick a mix of topic-specific vocabulary (the kind of words you genuinely need to discuss ${topic}) and natural narrative expressions.\n` +
      `Select words that are genuinely useful and varied — nouns, verbs, adjectives, phrasal verbs, idioms. Do not force or repeat the same common phrases every time.\n` +
      `Use clear standard English — no Australian slang.`;
  } else {
    // aussie mode
    contentInstruction =
      `Write a relaxed, natural conversation between two Australians called Alex and Sam about: ${topic}\n\n` +
      `IMPORTANT: Format as a proper dialogue with EACH speaker on its own line:\n` +
      `Alex: [what Alex says]\n` +
      `Sam: [what Sam says]\n` +
      `Alex: [reply]\n` +
      `Sam: [reply]\n` +
      `...at least 8 exchanges. Every speaker turn MUST be on a separate line starting with "Alex:" or "Sam:".`;
    wordInstruction =
      `Choose exactly 12 words or expressions that appear naturally in the conversation above.\n` +
      `Include a rich mix of: genuine Australian slang, everyday Aussie expressions, and topic-specific vocabulary related to ${topic}.\n` +
      `Cover a wide range — verbs, nouns, adjectives, slang phrases, idioms — so the learner builds broad Australian English vocabulary.\n` +
      `Avoid formal or literary words. Pick words that real Australians actually say in daily life.`;
  }

  return (
    `${contentInstruction}\n\n` +
    `${wordInstruction}\n\n` +
    `Wrap each target word/phrase in the content with **word** markers (e.g. **figure out**).\n\n` +
    `Return ONLY valid JSON — no markdown, no extra text:\n` +
    `{\n` +
    `  "title": "Short catchy title",\n` +
    `  "content": "Full content with **target words** wrapped",\n` +
    `  "words": [\n` +
    `    {"word": "figure out", "meaning": "to understand or solve something", "example": "I need to figure out what to do next."}\n` +
    `  ]\n` +
    `}\n\n` +
    `The words array must have exactly 12 entries matching the **marked** words in content.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, format = "dialog" } = await req.json();
  if (!topic?.trim()) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

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
        { role: "user", content: buildPrompt(topic.trim(), format) },
      ],
      { max_tokens: 1200, temperature: 0.8 }
    );
  } catch (err) {
    console.error("[topic/generate] Groq API error:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }

  try {
    const parsed = extractJson(raw) as { title: string; content: string; words: typeof words };
    title = parsed.title ?? topic;
    // Normalise dialog: AI sometimes puts multiple "Alex: ... Sam: ..." on one line
    // Insert a real newline before each inline speaker turn so the renderer splits correctly
    content = (parsed.content ?? "").replace(/(?<!\n)\s+(Alex|Sam):/g, "\n$1:");
    // Strip any ** markers the AI accidentally puts in the words array
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
      format,
      title,
      content,
      words: JSON.stringify(words),
    },
  });

  return NextResponse.json({ id: topicSession.id, title, content, words, format });
}
