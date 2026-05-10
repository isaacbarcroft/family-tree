"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button, Icon } from "@/components/ui";

const INVALID_LINK_MESSAGE = "Invalid or expired reset link. Please request a new one."
const TOKEN_PARSE_FAILURE_MESSAGE = "Failed to process reset token. Please request a new link."

interface RecoverySession {
  access_token: string
  refresh_token: string | undefined
  user: { id: unknown; email: unknown }
}

type HashParseResult =
  | { kind: "pending" }
  | { kind: "error"; message: string }
  | { kind: "ok"; session: RecoverySession }

function subscribeHash(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("hashchange", callback)
  return () => window.removeEventListener("hashchange", callback)
}

function getHashSnapshot(): string {
  if (typeof window === "undefined") return ""
  return window.location.hash
}

function getHashServerSnapshot(): string {
  return ""
}

// Parse the recovery hash Supabase sends with the email link, e.g.
// `#access_token=...&type=recovery&refresh_token=...`. Pure function so it can
// run during render — no setState-in-effect cascade.
export function parseRecoveryHash(rawHash: string): HashParseResult {
  if (typeof window === "undefined") return { kind: "pending" }

  const hash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash
  if (!hash) return { kind: "error", message: INVALID_LINK_MESSAGE }

  const params = new URLSearchParams(hash)
  const accessToken = params.get("access_token")
  const refreshToken = params.get("refresh_token")
  const type = params.get("type")

  if (type !== "recovery" || !accessToken) {
    return { kind: "error", message: INVALID_LINK_MESSAGE }
  }

  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]))
    return {
      kind: "ok",
      session: {
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
        user: { id: payload.sub, email: payload.email },
      },
    }
  } catch {
    return { kind: "error", message: TOKEN_PARSE_FAILURE_MESSAGE }
  }
}

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const rawHash = useSyncExternalStore(subscribeHash, getHashSnapshot, getHashServerSnapshot)
  const parsed = useMemo(() => parseRecoveryHash(rawHash), [rawHash])
  const sessionReady = parsed.kind === "ok"
  const hashError = parsed.kind === "error" ? parsed.message : ""
  const error = submitError || hashError

  // Persist the recovery session to localStorage so `supabase.auth.updateUser`
  // can find it. Lives in an effect because it's a write-side side effect, not
  // a state update.
  useEffect(() => {
    if (parsed.kind !== "ok") return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "family_tree_supabase_session",
      JSON.stringify(parsed.session),
    );
  }, [parsed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (password.length < 6) {
      setSubmitError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setSubmitError(updateError.message);
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
