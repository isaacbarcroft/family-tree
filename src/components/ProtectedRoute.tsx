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

  if (loading || !user) return null
  return <>{children}</>
}
