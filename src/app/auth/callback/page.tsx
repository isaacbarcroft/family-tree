"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Suspense } from "react"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")

  useEffect(() => {
    async function handleCallback() {
      // Supabase sends token_hash and type for email verification
      const tokenHash = searchParams.get("token_hash")
      const type = searchParams.get("type")

      if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })

        if (verifyError) {
          setError(verifyError.message)
          return
        }

        // Successfully verified — redirect to home
        router.push("/")
        return
      }

      // Check for hash fragments (implicit flow fallback)
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const accessToken = params.get("access_token")
        const refreshToken = params.get("refresh_token")

        if (accessToken) {
          // Decode user from JWT
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
            // Store session manually
            window.localStorage.setItem(
              "family_tree_supabase_session",
              JSON.stringify(session)
            )
            router.push("/")
            return
          } catch {
            setError("Failed to process authentication token.")
            return
          }
        }
      }

      // No valid params found — redirect to login
      router.push("/login?confirmed=1")
    }

    handleCallback()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Verification Failed</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-500 font-medium transition"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-300 text-lg">Verifying your email...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-gray-300 text-lg">Loading...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
