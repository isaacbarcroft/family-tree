"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { linkPersonToFamily, addPerson } from "@/lib/db"

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Loading...</div>}>
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const familyId = searchParams.get("family")
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
      // If invited to a family, create person and link
      if (familyId && data.user?.id) {
        try {
          const person = await addPerson({
            firstName: email.split("@")[0],
            lastName: "",
            roleType: "family member",
            email,
            createdBy: data.user.id,
            createdAt: new Date().toISOString(),
          })
          await linkPersonToFamily(person.id, familyId)
        } catch (err) {
          console.error("Failed to link to family:", err)
        }
      }
      router.push("/")
      return
    }

    setPendingEmailConfirmation(true)
  }

  if (pendingEmailConfirmation) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Confirm Your Email</h1>
          <p className="text-gray-300 mb-6">
            We sent a confirmation link to <span className="font-semibold text-white">{email}</span>.
            Please confirm your email, then sign in.
          </p>
          <Link
            href="/login?verify=1"
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-500 font-medium transition"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold text-white text-center">Create Account</h1>
        {familyId && (
          <p className="text-blue-400 text-base text-center">You&apos;ve been invited to join a family!</p>
        )}
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
        <input
          type="password"
          placeholder="Confirm Password"
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-500 w-full text-base font-medium min-h-[44px] transition"
        >
          Sign Up
        </button>
        <p className="text-center text-gray-300 text-base">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
