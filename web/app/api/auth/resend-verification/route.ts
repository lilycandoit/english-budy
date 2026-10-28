import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEmailVerificationToken, emailVerificationExpiry } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";

const GENERIC_RESPONSE = {
  message: "If that account needs verification, a new link has been sent.",
};

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.emailVerified) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  await prisma.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });

  const { token, tokenHash } = createEmailVerificationToken();
  await prisma.verificationToken.create({
    data: { identifier: normalizedEmail, token: tokenHash, expires: emailVerificationExpiry() },
  });

  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "Email verification is not configured" }, { status: 500 });
  }

  const verifyUrl = new URL("/verify-email", baseUrl);
  verifyUrl.searchParams.set("token", token);

  try {
    await sendVerificationEmail({ to: user.email, verifyUrl: verifyUrl.toString() });
  } catch (err) {
    const message = err instanceof Error && err.message === "EMAIL_NOT_CONFIGURED"
      ? "Email verification is not configured"
      : "Could not send verification email";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
