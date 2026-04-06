import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.learningSession.findMany({
    where: { userId: session.user.id },
    include: { quizResult: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      words: JSON.parse(s.words),
      createdAt: s.createdAt,
      score: s.quizResult?.score ?? null,
      total: s.quizResult?.total ?? null,
    }))
  );
}
