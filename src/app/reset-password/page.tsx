"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

function ResetPasswordContent() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase sends the recovery token as a hash fragment: #access_token=...&type=recovery
    if (typeof window === "undefined") return

    const hash = window.location.hash.substring(1)
    if (!hash) {
      setError("Invalid or expired reset link. Please request a new one.")
      return
    }

    const params = new URLSearchParams(hash)
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const type = params.get("type")

    if (type !== "recovery" || !accessToken) {
      setError("Invalid or expired reset link. Please request a new one.")
      return
    }

    // Store the recovery session so updateUser can use it
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]))
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
        user: {
          id: payload.sub,
          email: payload.email,
        },
      }
      window.localStorage.setItem(
        "family_tree_supabase_session",
        JSON.stringify(session)
      )
      setSessionReady(true)
    } catch {
      setError("Failed to process reset token. Please request a new link.")
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push("/"), 2000)
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
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
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Reset Failed</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <Link
            href="/forgot-password"
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-500 font-medium transition"
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
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-4"
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
          className="bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-500 w-full text-base font-medium min-h-[44px] transition disabled:opacity-50"
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
