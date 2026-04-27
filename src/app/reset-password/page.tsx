"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button, Icon } from "@/components/ui";

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.substring(1);
    if (!hash) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");
    if (type !== "recovery" || !accessToken) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
        user: { id: payload.sub, email: payload.email },
      };
      window.localStorage.setItem(
        "family_tree_supabase_session",
        JSON.stringify(session),
      );
      setSessionReady(true);
    } catch {
      setError("Failed to process reset token. Please request a new link.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/"), 2000);
  };

  if (success) {
    return (
      <AuthCenter>
        <div
          className="mb-4 flex justify-center"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--sage-tint)", color: "var(--sage-deep)" }}
          >
            <Icon name="check" size={20} />
          </div>
        </div>
        <h1 className="display" style={{ fontSize: 26, margin: 0, fontWeight: 500 }}>
          Password updated
        </h1>
        <p
          className="mt-3"
          style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}
        >
          Your password has been reset. Redirecting you now…
        </p>
      </AuthCenter>
    );
  }

  if (error && !sessionReady) {
    return (
      <AuthCenter>
        <h1 className="display" style={{ fontSize: 26, margin: 0, fontWeight: 500 }}>
          Reset failed
        </h1>
        <p
          className="mt-3"
          style={{ color: "var(--clay-deep)", fontSize: 15, lineHeight: 1.6 }}
        >
          {error}
        </p>
        <div className="mt-6">
          <Link href="/forgot-password" style={{ textDecoration: "none" }}>
            <Button variant="primary" icon="arrow">
              Request a new link
            </Button>
          </Link>
        </div>
      </AuthCenter>
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
            New password
          </p>
          <h1 className="display" style={{ fontSize: 26, margin: 0, fontWeight: 500 }}>
            Set a new password
          </h1>
        </div>
        {error ? (
          <p className="text-center" style={{ color: "var(--clay-deep)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-md p-3"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "1px solid var(--hairline)",
            fontSize: 15,
          }}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full rounded-md p-3"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "1px solid var(--hairline)",
            fontSize: 15,
          }}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={loading || !sessionReady}
          className="w-full"
        >
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

function AuthCenter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-[80vh] items-center justify-center px-6"
      style={{ background: "var(--paper)" }}
    >
      <div
        className="w-full max-w-sm rounded-lg p-10 text-center"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        {children}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="display-italic muted"
          style={{ textAlign: "center", padding: "96px 24px", fontSize: 18 }}
        >
          Loading…
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
