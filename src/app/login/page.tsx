"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"

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
    <form
      onSubmit={handleLogin}
      className="max-w-sm mx-auto mt-16 flex flex-col gap-3"
    >
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      {info && <p className="text-blue-600">{info}</p>}
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
      <button
        type="submit"
        className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        Login
      </button>
    </form>
  )
}
