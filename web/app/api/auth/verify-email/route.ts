import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashEmailVerificationToken } from "@/lib/emailVerification";

export async function POST(req: NextRequest) {
  const { token } = await req.json();

  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "Verification token is required" }, { status: 400 });
  }

  const tokenHash = hashEmailVerificationToken(token);
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!verificationToken || verificationToken.expires < new Date()) {
    return NextResponse.json({ error: "Verification link is invalid or expired" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { token: tokenHash },
    }),
  ]);

  return NextResponse.json({ message: "Email verified" });
}
