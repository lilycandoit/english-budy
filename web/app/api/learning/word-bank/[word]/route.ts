import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/learning/word-bank/[word] — fetch the full AI payload for one word,
// lazily loaded only when its chip is expanded in the UI.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ word: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { word } = await params;

  const entry = await prisma.wordEntry.findUnique({
    where: { userId_word: { userId: session.user.id, word: decodeURIComponent(word).toLowerCase() } },
  });

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ word: entry.word, wordInfo: JSON.parse(entry.wordInfo) });
}
