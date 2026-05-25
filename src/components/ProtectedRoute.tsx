"use client"
import { ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "./AuthProvider"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [user, loading, router])

  if (loading || !user)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p
          className="display-italic"
          style={{ color: "var(--ink-3)", fontSize: 18 }}
        >
          Loading…
        </p>
      </div>
    )
  return <>{children}</>
}
