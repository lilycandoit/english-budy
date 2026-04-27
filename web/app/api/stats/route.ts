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

  const now = new Date();
  const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const dayAgo   = new Date(now); dayAgo.setDate(dayAgo.getDate() - 1);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 28);

  const [
    wordTotal, wordThisWeek, wordToday, wordsRecent,
    mistakeStats, mistakesRecent,
    topicTotal, topicsRecent,
    flashcardReviews, schedules, quizResults,
  ] = await Promise.all([
    prisma.wordEntry.count({ where: { userId } }),
    prisma.wordEntry.count({ where: { userId, createdAt: { gte: weekAgo } } }),
    prisma.wordEntry.count({ where: { userId, createdAt: { gte: dayAgo } } }),
    prisma.wordEntry.findMany({ where: { userId, createdAt: { gte: monthAgo } }, select: { createdAt: true } }),
    prisma.mistake.groupBy({ by: ["mistakeType"], where: { userId }, _count: true }),
    prisma.mistake.findMany({ where: { userId, createdAt: { gte: monthAgo } }, select: { mistakeType: true, createdAt: true } }),
    prisma.topicSession.count({ where: { userId } }),
    prisma.topicSession.findMany({ where: { userId, createdAt: { gte: monthAgo } }, select: { createdAt: true } }),
    prisma.flashcardReview.findMany({ where: { userId, createdAt: { gte: monthAgo } }, select: { result: true, createdAt: true } }),
    prisma.wordSchedule.findMany({ where: { userId }, select: { repetitions: true } }),
    prisma.quizResult.findMany({
      where: { session: { userId } },
      select: { score: true, total: true },
    }),
  ]);

  // ── Streak ────────────────────────────────────────────────────────────────
  const activityDates = new Set<string>();
  for (const r of [...wordsRecent, ...mistakesRecent, ...topicsRecent, ...flashcardReviews]) {
    activityDates.add(toDateStr(r.createdAt));
  }
  const streak = calcStreak(activityDates);

  // ── Word stats ────────────────────────────────────────────────────────────
  const wordStats = { total: wordTotal, thisWeek: wordThisWeek, today: wordToday };

  // ── Mastery (SM-2 repetitions) ────────────────────────────────────────────
  const mastery = { new: 0, learning: 0, mastered: 0 };
  for (const s of schedules) {
    if (s.repetitions === 0)      mastery.new++;
    else if (s.repetitions <= 2)  mastery.learning++;
    else                          mastery.mastered++;
  }
  mastery.new += Math.max(0, wordTotal - schedules.length);

  // ── Sentence stats ────────────────────────────────────────────────────────
  const mistakeTotal = mistakeStats.reduce((sum, g) => sum + g._count, 0);
  const sentenceStats = { total: mistakeTotal, grammar: 0, spelling: 0, punctuation: 0, none: 0 };
  for (const g of mistakeStats) {
    const t = g.mistakeType as keyof typeof sentenceStats;
    if (t in sentenceStats) (sentenceStats[t] as number) += g._count;
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
      words:     wordsRecent.filter(w => w.createdAt >= d && w.createdAt < next).length,
      sentences: mistakesRecent.filter(m => m.createdAt >= d && m.createdAt < next).length,
      topics:    topicsRecent.filter(t => t.createdAt >= d && t.createdAt < next).length,
    });
  }

  return NextResponse.json({
    streak,
    words: wordStats,
    mastery,
    sentences: sentenceStats,
    topics: topicTotal,
    quizAverage,
    activity,
  });
}
