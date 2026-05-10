"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button, Icon } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div
        className="flex min-h-[80vh] items-center justify-center px-6"
        style={{ background: "var(--paper)" }}
      >
        <div
          className="w-full max-w-sm rounded-lg p-10 text-center"
          style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
        >
          <div className="mb-4 flex justify-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--sage-tint)", color: "var(--sage-deep)" }}
            >
              <Icon name="bell" size={20} />
            </div>
          </div>
          <h1 className="display" style={{ fontSize: 26, margin: 0, fontWeight: 500 }}>
            Check your email
          </h1>
          <p
            className="mt-3"
            style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}
          >
            We sent a password reset link to{" "}
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>
              {email}
            </span>
            . Click the link to set a new password.
          </p>
          <div className="mt-6">
            <Link href="/login" style={{ textDecoration: "none" }}>
              <Button variant="primary" icon="arrow">
                Back to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[80vh] items-center justify-center px-6"
      style={{ background: "var(--paper)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg p-8"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <div className="text-center">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            Forgot password
          </p>
          <h1 className="display" style={{ fontSize: 26, margin: 0, fontWeight: 500 }}>
            Reset your password
          </h1>
        </div>
        <p
          className="text-center"
          style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}
        >
          Enter your email and we&rsquo;ll send you a link to set a new password.
        </p>
        {error ? (
          <p className="text-center" style={{ color: "var(--clay-deep)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-md p-3"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "1px solid var(--hairline)",
            fontSize: 15,
          }}
        />
        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
        <p className="text-center" style={{ fontSize: 14, color: "var(--ink-3)" }}>
          Remember your password?{" "}
          <Link href="/login" style={{ color: "var(--sage-deep)" }}>
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
