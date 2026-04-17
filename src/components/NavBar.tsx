"use client"

import Link from "next/link"
import { useAuth } from "./AuthProvider"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useRef } from "react"
import type { Person } from "@/models/Person"
import type { Family } from "@/models/Family"

export default function NavBar() {
  const { user } = useAuth()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<{ type: "person" | "family"; id: string; label: string }[]>([])
  const [showResults, setShowResults] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const term = search.toLowerCase()
      const [{ data: people }, { data: families }] = await Promise.all([
        supabase.from("people").select("*").ilike("searchName", `%${term}%`).limit(5),
        supabase.from("families").select("*").ilike("name", `%${term}%`).limit(3),
      ])

      const results: { type: "person" | "family"; id: string; label: string }[] = []
      if (people) {
        for (const p of people as Person[]) {
          results.push({ type: "person", id: p.id, label: `${p.firstName} ${p.lastName}` })
        }
      }
      if (families) {
        for (const f of families as Family[]) {
          results.push({ type: "family", id: f.id, label: f.name })
        }
      }
      setSearchResults(results)
      setShowResults(true)
    }, 300)
  }, [search])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Logout failed", error)
      return
    }
    router.push("/login")
  }

  const navLinks = [
    { href: "/family-tree", label: "People" },
    { href: "/timeline", label: "Timeline" },
    { href: "/memories", label: "Memories" },
    { href: "/events", label: "Events" },
    { href: "/families", label: "Families" },
  ]

  return (
    <nav className="bg-[var(--card-bg)] text-white p-4 border-b border-[var(--card-border)]">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="font-bold text-xl hover:text-[var(--accent)] transition">
          <span className="warm-gradient">Family Legacy</span>
        </Link>

        {user && (
          <div className="hidden md:flex items-center space-x-4 flex-1 justify-end">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[var(--accent)] text-base transition">
                {link.label}
              </Link>
            ))}

            {/* Search */}
            <div ref={searchRef} className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onKeyDown={(e) => e.key === "Escape" && setShowResults(false)}
                placeholder="Search..."
                className="bg-gray-800 border border-gray-700 text-gray-100 text-base px-3 py-2 rounded-lg w-44 focus:w-60 transition-all focus:outline-none focus:border-[var(--accent)]"
              />
              {showResults && searchResults.length > 0 && (
                <ul className="absolute top-full right-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
                  {searchResults.map((r) => (
                    <li key={`${r.type}-${r.id}`}>
                      <Link
                        href={r.type === "person" ? `/profile/${r.id}` : `/family/${r.id}`}
                        onClick={() => {
                          setSearch("")
                          setShowResults(false)
                        }}
                        className="block px-3 py-2.5 hover:bg-gray-700 text-base"
                      >
                        <span className="text-gray-400 text-sm mr-2">
                          {r.type === "person" ? "Person" : "Family"}
                        </span>
                        {r.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="bg-gray-700 px-4 py-2 rounded-lg hover:bg-gray-600 text-base font-medium min-h-[44px]"
            >
              Logout
            </button>
          </div>
        )}

        {/* Mobile menu button */}
        {user && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-300 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        )}

        {!user && (
          <div className="space-x-4 flex items-center">
            <Link href="/login" className="hover:text-[var(--accent)]">Login</Link>
            <Link href="/signup" className="hover:text-[var(--accent)]">Signup</Link>
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {user && mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-800 space-y-2">
          {/* Mobile search */}
          <div ref={searchRef} className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onKeyDown={(e) => e.key === "Escape" && setShowResults(false)}
              placeholder="Search people & families..."
              className="bg-gray-800 border border-gray-700 text-gray-100 text-base px-3 py-2.5 rounded-lg w-full focus:outline-none focus:border-[var(--accent)]"
            />
            {showResults && searchResults.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {searchResults.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <Link
                      href={r.type === "person" ? `/profile/${r.id}` : `/family/${r.id}`}
                      onClick={() => {
                        setSearch("")
                        setShowResults(false)
                        setMobileMenuOpen(false)
                      }}
                      className="block px-3 py-2.5 hover:bg-gray-700 text-base"
                    >
                      <span className="text-gray-400 text-sm mr-2">
                        {r.type === "person" ? "Person" : "Family"}
                      </span>
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-base hover:text-[var(--accent)]"
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="block w-full text-left py-2 text-gray-300 hover:text-white"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
