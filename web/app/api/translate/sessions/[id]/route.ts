import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/translate/sessions/[id] — fetch the full row-pairs payload for one
// translation, lazily loaded only when a history entry is opened.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Scoped by userId AND id together — a cuid is unguessable, but this still
  // prevents one user from ever fetching another user's translation by id.
  const entry = await prisma.translationEntry.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: entry.id,
    sourceText: entry.sourceText,
    rows: JSON.parse(entry.rows),
    createdAt: entry.createdAt,
  });
}
