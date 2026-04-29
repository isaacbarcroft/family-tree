"use client"

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

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
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const rawHash = useSyncExternalStore(subscribeHash, getHashSnapshot, getHashServerSnapshot)
  const parsed = useMemo(() => parseRecoveryHash(rawHash), [rawHash])
  const sessionReady = parsed.kind === "ok"
  const hashError = parsed.kind === "error" ? parsed.message : ""
  const error = submitError || hashError

  // Persist the recovery session to localStorage so `supabase.auth.updateUser`
  // can find it. Lives in an effect because it's a write-side side effect, not
  // a state update.
  useEffect(() => {
    if (parsed.kind !== "ok") return
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      "family_tree_supabase_session",
      JSON.stringify(parsed.session),
    )
  }, [parsed])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")

    if (password.length < 6) {
      setSubmitError("Password must be at least 6 characters")
      return
    }

    if (password !== confirm) {
      setSubmitError("Passwords do not match")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (updateError) {
      setSubmitError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push("/"), 2000)
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">
            Password Updated
          </h1>
          <p className="text-gray-300 mb-6">
            Your password has been reset successfully. Redirecting you now...
          </p>
        </div>
      </div>
    )
  }

  if (error && !sessionReady) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Reset Failed</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <Link
            href="/forgot-password"
            className="inline-block bg-[var(--accent)] text-white px-6 py-2.5 rounded-lg hover:bg-[var(--accent-hover)] font-medium transition"
          >
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold text-white text-center">
          Set New Password
        </h1>
        {error && (
          <p className="text-red-400 text-base text-center">{error}</p>
        )}

        <input
          type="password"
          placeholder="New password"
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading || !sessionReady}
          className="bg-[var(--accent)] text-white py-2.5 rounded-lg hover:bg-[var(--accent-hover)] w-full text-base font-medium min-h-[44px] transition disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-gray-300 text-lg">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
