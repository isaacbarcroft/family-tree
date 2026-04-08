"use client"

import { ReactNode, useEffect, useState, createContext, useContext } from "react"
import { supabase } from "@/lib/supabase"
import type { AppUser } from "@/lib/supabase"
import { getOrCreatePersonForUser } from "@/lib/userPersonLink"

interface AuthContextType {
  user: AppUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true })

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    getOrCreatePersonForUser(user).catch((err) => {
      console.error("Unable to link user to person", err)
    })
  }, [user])

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error("Failed to load auth session", error)
      }
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}
