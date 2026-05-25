import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPasswordResetToken, passwordResetExpiry } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";

const GENERIC_RESPONSE = {
  message: "If an account exists for that email, a reset link has been sent.",
};

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const { token, tokenHash } = createPasswordResetToken();
  const expiresAt = passwordResetExpiry();

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "Password reset is not configured" }, { status: 500 });
  }

  const resetUrl = new URL("/reset-password", baseUrl);
  resetUrl.searchParams.set("token", token);

  try {
    await sendPasswordResetEmail({ to: user.email, resetUrl: resetUrl.toString() });
  } catch (err) {
    await prisma.passwordResetToken.delete({ where: { tokenHash } }).catch(() => {});
    const message = err instanceof Error && err.message === "EMAIL_NOT_CONFIGURED"
      ? "Password reset email is not configured"
      : "Could not send password reset email";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
