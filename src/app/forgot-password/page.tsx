"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    )

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Check Your Email</h1>
          <p className="text-gray-300 mb-6">
            We sent a password reset link to{" "}
            <span className="font-semibold text-white">{email}</span>. Click the
            link in the email to set a new password.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[var(--accent)] text-white px-6 py-2.5 rounded-lg hover:bg-[var(--accent-hover)] font-medium transition"
          >
            Back to Login
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
          Reset Password
        </h1>
        <p className="text-gray-300 text-base text-center">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
        {error && (
          <p className="text-red-400 text-base text-center">{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--accent)] text-white py-2.5 rounded-lg hover:bg-[var(--accent-hover)] w-full text-base font-medium min-h-[44px] transition disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
        <p className="text-center text-gray-300 text-base">
          Remember your password?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
