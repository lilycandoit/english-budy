import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function sm2(
  sched: { easeFactor: number; intervalDays: number; repetitions: number },
  result: "known" | "review"
) {
  if (result === "known") {
    let newInterval: number;
    if (sched.repetitions === 0) newInterval = 1;
    else if (sched.repetitions === 1) newInterval = 3;
    else newInterval = Math.round(sched.intervalDays * sched.easeFactor);

    return {
      easeFactor: Math.min(Math.round((sched.easeFactor + 0.1) * 100) / 100, 3.0),
      intervalDays: newInterval,
      repetitions: sched.repetitions + 1,
    };
  } else {
    return {
      easeFactor: Math.max(Math.round((sched.easeFactor - 0.2) * 100) / 100, 1.3),
      intervalDays: 1,
      repetitions: 0,
    };
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reviews } = await req.json() as {
    reviews: { word: string; result: "known" | "review" }[];
  };

  if (!reviews?.length) return NextResponse.json({ error: "No reviews provided" }, { status: 400 });

  const now = new Date();

  for (const item of reviews) {
    // Save raw rating
    await prisma.flashcardReview.create({
      data: { userId: session.user.id, word: item.word, result: item.result },
    });

    // Upsert SM-2 schedule
    const existing = await prisma.wordSchedule.findUnique({
      where: { userId_word: { userId: session.user.id, word: item.word } },
    });

    const sched = existing ?? { easeFactor: 2.5, intervalDays: 1, repetitions: 0 };
    const updated = sm2(sched, item.result);
    const nextReview = new Date(now.getTime() + updated.intervalDays * 86400000);

    await prisma.wordSchedule.upsert({
      where: { userId_word: { userId: session.user.id, word: item.word } },
      update: { ...updated, nextReviewAt: nextReview, lastReviewedAt: now },
      create: {
        userId: session.user.id,
        word: item.word,
        ...updated,
        nextReviewAt: nextReview,
        lastReviewedAt: now,
      },
    });
  }

  return NextResponse.json({ ok: true, count: reviews.length });
}
