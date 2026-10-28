import nodemailer from "nodemailer";

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("EMAIL_NOT_CONFIGURED");
  }

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  return { transport, from: user };
}

interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({ to, resetUrl }: SendPasswordResetEmailParams) {
  const { transport, from } = getTransport();

  try {
    await transport.sendMail({
      from,
      to,
      subject: "Reset your Daily English Buddy password",
      html: `
        <p>Use this link to reset your Daily English Buddy password:</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>
      `,
      text: [
        "Use this link to reset your Daily English Buddy password:",
        resetUrl,
        "",
        "This link expires in 1 hour. If you did not request it, you can ignore this email.",
      ].join("\n"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`EMAIL_SEND_FAILED:${message}`);
  }
}

interface SendVerificationEmailParams {
  to: string;
  verifyUrl: string;
}

export async function sendVerificationEmail({ to, verifyUrl }: SendVerificationEmailParams) {
  const { transport, from } = getTransport();

  try {
    await transport.sendMail({
      from,
      to,
      subject: "Verify your Daily English Buddy email",
      html: `
        <p>Welcome to Daily English Buddy! Use this link to verify your email and activate your account:</p>
        <p><a href="${verifyUrl}">Verify email</a></p>
        <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      `,
      text: [
        "Welcome to Daily English Buddy! Use this link to verify your email and activate your account:",
        verifyUrl,
        "",
        "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
      ].join("\n"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`EMAIL_SEND_FAILED:${message}`);
  }
}
