import crypto from "crypto";

export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashEmailVerificationToken(token) };
}

export function hashEmailVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function emailVerificationExpiry() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24);
}
