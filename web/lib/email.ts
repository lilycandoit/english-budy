import nodemailer from "nodemailer";

interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({ to, resetUrl }: SendPasswordResetEmailParams) {
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

  try {
    await transport.sendMail({
      from: user,
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
