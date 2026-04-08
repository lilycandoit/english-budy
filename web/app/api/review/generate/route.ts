import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroqKey, groqChat } from "@/lib/groq";

const SYSTEM = "You are an Australian English creative writing teacher.";

function buildPrompt(words: string[]): string {
  return (
    `Write a natural, engaging story of about 250 words set in Australia that uses all of these words: ${words.join(", ")}\n\n` +
    `Wrap each target word in the story with **word** markers (e.g. **reckon**).\n` +
    `The story should read naturally — don't force words awkwardly.\n` +
    `Return ONLY the story text, no JSON, no extra explanation.`
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { words } = await req.json();
  if (!words?.length) return NextResponse.json({ error: "Words are required" }, { status: 400 });

  let apiKey: string;
  try {
    apiKey = await getUserGroqKey(session.user.id);
  } catch {
    return NextResponse.json({ error: "No Groq API key set" }, { status: 422 });
  }

  let story = "";
  try {
    story = await groqChat(
      apiKey,
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(words) },
      ],
      { max_tokens: 600, temperature: 0.8 }
    );
  } catch {
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }

  const reviewSession = await prisma.reviewSession.create({
    data: {
      userId: session.user.id,
      words: JSON.stringify(words),
      story,
    },
  });

  return NextResponse.json({ id: reviewSession.id, story, words });
}
