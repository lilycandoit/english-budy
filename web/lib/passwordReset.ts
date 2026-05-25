import crypto from "crypto";

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function passwordResetExpiry() {
  return new Date(Date.now() + 1000 * 60 * 60);
}
