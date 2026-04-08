import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, answers } = await req.json();

  const learningSession = await prisma.learningSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  });

  if (!learningSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const quiz = JSON.parse(learningSession.quiz ?? "[]") as {
    question: string;
    options: string[];
    answer: string;
    explanation?: string;
    word: string;
  }[];

  const feedback = quiz.map((q, i) => {
    const selected = answers[i] ?? "";
    const correct = selected.trim().toLowerCase() === q.answer.trim().toLowerCase();
    return { correct, correctAnswer: q.answer, selected, explanation: q.explanation ?? "" };
  });

  const score = feedback.filter((f) => f.correct).length;

  await prisma.quizResult.create({
    data: {
      sessionId,
      score,
      total: quiz.length,
      answers: JSON.stringify(answers),
    },
  });

  return NextResponse.json({ score, total: quiz.length, feedback });
}
