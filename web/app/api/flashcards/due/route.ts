import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  const dueSchedules = await prisma.wordSchedule.findMany({
    where: { userId: session.user.id, nextReviewAt: { lte: now } },
    orderBy: { nextReviewAt: "asc" },
  });

  // Fetch word info from word bank for each due word
  const cards = await Promise.all(
    dueSchedules.map(async (s) => {
      const entry = await prisma.wordEntry.findUnique({
        where: { userId_word: { userId: session.user.id, word: s.word } },
      });
      const daysOverdue = Math.floor((now.getTime() - s.nextReviewAt.getTime()) / 86400000);
      return {
        word: s.word,
        wordInfo: entry ? JSON.parse(entry.wordInfo) : null,
        daysOverdue,
      };
    })
  );

  return NextResponse.json({
    dueCount: cards.length,
    cards: cards.filter((c) => c.wordInfo !== null),
  });
}
