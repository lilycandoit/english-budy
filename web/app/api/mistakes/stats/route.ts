import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const counts = await prisma.mistake.groupBy({
    by: ["mistakeType"],
    where: { userId: session.user.id },
    _count: { _all: true },
  });

  const stats: Record<string, number> = { grammar: 0, spelling: 0, punctuation: 0, none: 0 };
  for (const row of counts) {
    stats[row.mistakeType] = row._count._all;
  }
  stats.total = Object.values(stats).reduce((a, b) => a + b, 0);

  return NextResponse.json(stats);
}
