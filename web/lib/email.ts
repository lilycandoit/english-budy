interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({ to, resetUrl }: SendPasswordResetEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("EMAIL_NOT_CONFIGURED");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
  });

  if (!res.ok) {
    throw new Error(`EMAIL_SEND_FAILED:${res.status}:${await res.text()}`);
  }
}
