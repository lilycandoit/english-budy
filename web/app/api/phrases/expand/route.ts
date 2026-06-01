import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

interface PhraseQuiz {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface PhraseExpansion {
  phrase: string;
  meaning: string;
  alternatives: PhraseAlternativeGroup[];
  notes: string[];
  quiz: PhraseQuiz | null;
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

  const quizObj = obj.quiz && typeof obj.quiz === "object" ? obj.quiz as Record<string, unknown> : null;
  const options = quizObj ? asStringArray(quizObj.options) : [];
  const quiz = quizObj && options.length >= 2
    ? {
        question: asString(quizObj.question),
        options,
        answer: asString(quizObj.answer),
        explanation: asString(quizObj.explanation),
      }
    : null;

  return {
    phrase: asString(obj.phrase, phrase),
    meaning: asString(obj.meaning),
    alternatives,
    notes: asStringArray(obj.notes),
    quiz,
  };
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
    `    {\n` +
    `      "label": "Casual",\n` +
    `      "description": "When this group sounds natural.",\n` +
    `      "items": [\n` +
    `        {\n` +
    `          "text": "alternative phrase",\n` +
    `          "tone": "casual / neutral / professional / softer / stronger",\n` +
    `          "whenToUse": "Specific situation where this sounds natural.",\n` +
    `          "avoidWhen": "When this sounds too direct, too formal, too casual, rude, outdated, or unnatural.",\n` +
    `          "example": "One short everyday Australian English example sentence."\n` +
    `        }\n` +
    `      ]\n` +
    `    }\n` +
    `  ],\n` +
    `  "notes": ["Useful fact, Australian usage note, or learner warning."],\n` +
    `  "quiz": {\n` +
    `    "question": "A situation question asking which alternative fits best.",\n` +
    `    "options": ["option A", "option B", "option C"],\n` +
    `    "answer": "exact correct option",\n` +
    `    "explanation": "Why this option fits."\n` +
    `  }\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Include 3-5 groups such as Casual, Neutral, Professional, Softer, Stronger, or Australian English.\n` +
    `- Include 2-4 alternatives per group.\n` +
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
      { max_tokens: 1700, temperature: 0.65 }
    );

    const expansion = normalizeExpansion(extractJson(raw), input);
    if (!expansion.alternatives.length) throw new Error("No alternatives returned");
    return NextResponse.json(expansion);
  } catch {
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }
}
