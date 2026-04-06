import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [entries, total, thisWeek, today] = await Promise.all([
    prisma.wordEntry.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.wordEntry.count({ where: { userId: session.user.id } }),
    prisma.wordEntry.count({ where: { userId: session.user.id, updatedAt: { gte: weekStart } } }),
    prisma.wordEntry.count({ where: { userId: session.user.id, updatedAt: { gte: todayStart } } }),
  ]);

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      word: e.word,
      wordInfo: JSON.parse(e.wordInfo),
      updatedAt: e.updatedAt,
    })),
    stats: { total, thisWeek, today },
  });
}
