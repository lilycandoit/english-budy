import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function calcStreak(dates: Set<string>): number {
  const today = toDateStr(new Date());
  let streak = 0;
  let cursor = new Date();

  // If no activity today, start counting from yesterday
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);

  while (true) {
    const key = toDateStr(cursor);
    if (!dates.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [words, mistakes, topics, flashcardReviews, schedules, quizResults] = await Promise.all([
    prisma.wordEntry.findMany({ where: { userId }, select: { createdAt: true } }),
    prisma.mistake.findMany({ where: { userId }, select: { mistakeType: true, createdAt: true } }),
    prisma.topicSession.findMany({ where: { userId }, select: { createdAt: true } }),
    prisma.flashcardReview.findMany({ where: { userId }, select: { result: true, createdAt: true } }),
    prisma.wordSchedule.findMany({ where: { userId }, select: { repetitions: true } }),
    prisma.quizResult.findMany({
      where: { session: { userId } },
      select: { score: true, total: true },
    }),
  ]);

  // ── Streak ────────────────────────────────────────────────────────────────
  const activityDates = new Set<string>();
  for (const r of [...words, ...mistakes, ...topics, ...flashcardReviews]) {
    activityDates.add(toDateStr(r.createdAt));
  }
  const streak = calcStreak(activityDates);

  // ── Word stats ────────────────────────────────────────────────────────────
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const dayAgo  = new Date(now); dayAgo.setDate(dayAgo.getDate() - 1);
  const wordStats = {
    total:    words.length,
    thisWeek: words.filter(w => w.createdAt >= weekAgo).length,
    today:    words.filter(w => w.createdAt >= dayAgo).length,
  };

  // ── Mastery (SM-2 repetitions) ────────────────────────────────────────────
  const mastery = { new: 0, learning: 0, mastered: 0 };
  for (const s of schedules) {
    if (s.repetitions === 0)      mastery.new++;
    else if (s.repetitions <= 2)  mastery.learning++;
    else                          mastery.mastered++;
  }
  // Words in word bank but not yet reviewed are "new"
  mastery.new += Math.max(0, words.length - schedules.length);

  // ── Sentence stats ────────────────────────────────────────────────────────
  const sentenceStats = { total: mistakes.length, grammar: 0, spelling: 0, punctuation: 0, none: 0 };
  for (const m of mistakes) {
    const t = m.mistakeType as keyof typeof sentenceStats;
    if (t in sentenceStats) (sentenceStats[t] as number)++;
  }

  // ── Quiz average ──────────────────────────────────────────────────────────
  const quizAverage = quizResults.length
    ? Math.round(quizResults.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) / quizResults.length)
    : null;

  // ── Activity heatmap (last 28 days) ───────────────────────────────────────
  const activity: { date: string; words: number; sentences: number; topics: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    activity.push({
      date:      toDateStr(d),
      words:     words.filter(w => w.createdAt >= d && w.createdAt < next).length,
      sentences: mistakes.filter(m => m.createdAt >= d && m.createdAt < next).length,
      topics:    topics.filter(t => t.createdAt >= d && t.createdAt < next).length,
    });
  }

  return NextResponse.json({
    streak,
    words: wordStats,
    mastery,
    sentences: sentenceStats,
    topics: topics.length,
    quizAverage,
    activity,
  });
}
