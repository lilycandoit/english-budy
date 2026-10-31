import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.writingEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, nativeText: true, englishText: true, tip: true, createdAt: true },
  });

  // Group by date (YYYY-MM-DD), same pattern as GET /api/review/words and
  // GET /api/translate/sessions. Entries here are small/fixed-shape, so the
  // full payload is returned directly — no lazy-detail route needed.
  const grouped: Record<string, typeof entries> = {};
  for (const e of entries) {
    const dateKey = e.createdAt.toISOString().slice(0, 10);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(e);
  }

  return NextResponse.json(grouped);
}
