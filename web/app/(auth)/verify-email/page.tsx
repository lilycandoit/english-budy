"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailShell />}>
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailShell() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface rounded-2xl shadow-sm border border p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-ink-primary">Verifying email...</h1>
      </div>
    </div>
  );
}

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Verification link is missing a token.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setError(data.error || "Could not verify email");
          return;
        }
        setStatus("success");
      })
      .catch(() => {
        setStatus("error");
        setError("Could not verify email");
      });
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendLoading(true);
    setResendMessage("");

    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    const data = await res.json();
    setResendLoading(false);
    setResendMessage(data.message || data.error || "Something went wrong");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface rounded-2xl shadow-sm border border p-8 w-full max-w-sm">
        {status === "verifying" && (
          <>
            <h1 className="text-2xl font-bold text-ink-primary">Verifying email...</h1>
            <p className="text-ink-muted text-sm mt-1">One moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-ink-primary">Email verified</h1>
            <p className="text-good text-sm mt-1">Your account is now active.</p>
            <Link
              href="/login"
              className="block text-center bg-primary text-primary-ink rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover transition-colors mt-5"
            >
              Sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-ink-primary">Verification failed</h1>
            <p className="text-bad text-sm mt-1">{error}</p>

            <form onSubmit={handleResend} className="space-y-3 mt-5">
              <div>
                <label className="block text-sm font-medium text-ink-primary mb-1">
                  Resend verification link
                </label>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                  className="w-full bg-surface text-ink-primary border border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              {resendMessage && <p className="text-good text-sm">{resendMessage}</p>}

              <button
                type="submit"
                disabled={resendLoading}
                className="w-full bg-primary text-primary-ink rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {resendLoading ? "Sending…" : "Resend link"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-ink-muted mt-5">
          <Link href="/login" className="text-primary hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
