"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user) router.push("/")
  }, [user, router])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setError("")

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login?confirmed=1`
        : undefined

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data?.access_token) {
      router.push("/")
      return
    }

    setPendingEmailConfirmation(true)
  }

  if (pendingEmailConfirmation) {
    return (
      <div className="max-w-md mx-auto mt-16 border border-gray-700 rounded p-6 bg-gray-900 text-gray-100">
        <h1 className="text-2xl font-bold mb-3">Confirm your email</h1>
        <p className="text-gray-300 mb-4">
          We sent a confirmation link to <span className="font-semibold">{email}</span>.
          Please confirm your email, then sign in.
        </p>
        <Link
          href="/login?verify=1"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSignup}
      className="max-w-sm mx-auto mt-16 flex flex-col gap-3"
    >
      <h1 className="text-2xl font-bold mb-4">Create Account</h1>
      {error && <p className="text-red-500">{error}</p>}

      <input
        type="email"
        placeholder="Email"
        className="border p-2 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="border p-2 rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Confirm Password"
        className="border p-2 rounded"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button
        type="submit"
        className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        Sign Up
      </button>
    </form>
  )
}
