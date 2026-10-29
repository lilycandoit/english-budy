import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (typeof name !== "string") {
    return NextResponse.json({ error: "Name must be a string" }, { status: 400 });
  }

  const trimmed = name.trim();
  if (trimmed.length > 60) {
    return NextResponse.json({ error: "Name must be 60 characters or fewer" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: trimmed || null },
  });

  return NextResponse.json({ name: user.name });
}
