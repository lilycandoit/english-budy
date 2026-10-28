"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface rounded-2xl shadow-sm border border p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-ink-primary">Check your email</h1>
          <p className="text-ink-muted text-sm mt-2">
            We sent a verification link to <span className="text-ink-primary font-medium">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link
            href="/login"
            className="block text-center bg-primary text-primary-ink rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover transition-colors mt-5"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface rounded-2xl shadow-sm border border p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-primary">Create account</h1>
          <p className="text-ink-muted text-sm mt-1">Start learning with Daily English Buddy</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-primary mb-1">
              Name <span className="text-ink-secondary font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface text-ink-primary border border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Alex"
            />
          </div>

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
            <label className="block text-sm font-medium text-ink-primary mb-1">Password</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>

          {error && <p className="text-bad text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-ink rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-ink-muted mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
