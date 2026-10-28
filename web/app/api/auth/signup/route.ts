import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createEmailVerificationToken, emailVerificationExpiry } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name: name || null, email: normalizedEmail, password: hashed },
    });

    const { token, tokenHash } = createEmailVerificationToken();
    await prisma.verificationToken.create({
      data: { identifier: normalizedEmail, token: tokenHash, expires: emailVerificationExpiry() },
    });

    const baseUrl = process.env.NEXTAUTH_URL;
    if (baseUrl) {
      const verifyUrl = new URL("/verify-email", baseUrl);
      verifyUrl.searchParams.set("token", token);
      try {
        await sendVerificationEmail({ to: user.email, verifyUrl: verifyUrl.toString() });
      } catch (err) {
        // Account creation already succeeded — don't fail the signup response over
        // a send failure. The resend-verification flow is the recovery path.
        console.error("Verification email send failed:", err);
      }
    } else {
      console.error("NEXTAUTH_URL is not set — could not build a verification link");
    }

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
