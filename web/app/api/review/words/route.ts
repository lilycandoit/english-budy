import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.wordEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { word: true, updatedAt: true },
  });

  // Group by date (YYYY-MM-DD)
  const grouped: Record<string, string[]> = {};
  for (const e of entries) {
    const dateKey = e.updatedAt.toISOString().slice(0, 10);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(e.word);
  }

  return NextResponse.json(grouped);
}
