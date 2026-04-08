"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user) router.push("/")
  }, [user, router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("confirmed") === "1") {
      setInfo("Email confirmed. You can sign in now.")
      return
    }
    if (params.get("verify") === "1") {
      setInfo("Check your inbox and confirm your email before signing in.")
      return
    }
    setInfo("")
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      const message = signInError.message.toLowerCase()
      if (message.includes("email") && message.includes("confirm")) {
        setError("Please confirm your email before signing in.")
      } else {
        setError("Invalid email or password")
      }
      return
    }

    router.push("/")
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold text-white text-center">Welcome Back</h1>
        {info && <p className="text-blue-400 text-base text-center">{info}</p>}
        {error && <p className="text-red-400 text-base text-center">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="bg-[var(--accent)] text-white py-2.5 rounded-lg hover:bg-[var(--accent-hover)] w-full text-base font-medium min-h-[44px] transition"
        >
          Log In
        </button>
        <p className="text-center">
          <Link href="/forgot-password" className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-base">
            Forgot your password?
          </Link>
        </p>
        <p className="text-center text-gray-300 text-base">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}
