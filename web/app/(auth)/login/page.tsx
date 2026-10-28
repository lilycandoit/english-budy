"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNeedsVerification(false);

    const res = await signIn("credentials", { email, password, redirect: false });

    setLoading(false);
    if (res?.error) {
      if (res.error === "EMAIL_NOT_VERIFIED") {
        setError("Please verify your email before signing in. Check your inbox, or request a new link below.");
        setNeedsVerification(true);
      } else {
        setError("Invalid email or password");
      }
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface rounded-2xl shadow-sm border border p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-primary">Welcome back</h1>
          <p className="text-ink-muted text-sm mt-1">Sign in to Daily English Buddy</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-primary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface text-ink-primary border border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-ink-primary">Password</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                Forgot?
              </Link>
            </div>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-bad text-sm">{error}</p>}
          {needsVerification && (
            <Link href="/verify-email" className="block text-sm text-primary hover:underline font-medium">
              Resend verification link
            </Link>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-ink rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-ink-muted mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
