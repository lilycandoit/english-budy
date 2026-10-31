import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PREVIEW_LENGTH = 100;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.translationEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, sourceText: true, createdAt: true },
  });

  // Group by date (YYYY-MM-DD), same pattern as GET /api/review/words.
  // Only a short preview of sourceText is sent — never the (larger) `rows`
  // payload, which is lazily fetched per entry via GET /api/translate/sessions/[id].
  const grouped: Record<string, { id: string; preview: string; createdAt: string }[]> = {};
  for (const e of entries) {
    const dateKey = e.createdAt.toISOString().slice(0, 10);
    const preview = e.sourceText.length > PREVIEW_LENGTH
      ? e.sourceText.slice(0, PREVIEW_LENGTH) + "…"
      : e.sourceText;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push({ id: e.id, preview, createdAt: e.createdAt.toISOString() });
  }

  return NextResponse.json(grouped);
}
