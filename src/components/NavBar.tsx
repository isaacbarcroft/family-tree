"use client"

import Link from "next/link"
import { useAuth } from "./AuthProvider"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useRef } from "react"
import type { Person } from "@/models/Person"
import type { Family } from "@/models/Family"

type NavLink = { href: string; label: string; icon: React.ReactNode }

const navLinks: NavLink[] = [
  {
    href: "/family-tree",
    label: "People",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/timeline",
    label: "Timeline",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/places",
    label: "Places",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
      </svg>
    ),
  },
  {
    href: "/memories",
    label: "Memories",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/families",
    label: "Families",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
]

export default function NavBar() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<{ type: "person" | "family"; id: string; label: string }[]>([])
  const [showResults, setShowResults] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [myPersonId, setMyPersonId] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isActive = (href: string) =>
    pathname === href || (pathname !== null && pathname.startsWith(href + "/"))

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

  // Resolve current user's person record so the menu can link to their profile
  useEffect(() => {
    if (!user) {
      setMyPersonId(null)
      return
    }
    let cancelled = false
    supabase
      .from("people")
      .select("id")
      .eq("userId", user.id)
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return
        const first = Array.isArray(data) && data.length > 0 ? (data[0] as { id: string }) : null
        setMyPersonId(first?.id ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setUserMenuOpen(false)
    setShowResults(false)
  }, [pathname])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Logout failed", error)
      return
    }
    router.push("/login")
  }

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?"

  return (
    <nav className="sticky top-0 z-40 bg-[var(--background)]/80 backdrop-blur border-b border-[var(--card-border)]">
      <div className="container mx-auto flex justify-between items-center px-4 h-16">
        <Link
          href="/"
          className="font-bold text-xl tracking-tight transition-colors"
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className="warm-gradient">Family Legacy</span>
        </Link>

        {user && (
          <div className="hidden md:flex items-center gap-1 flex-1 justify-end">
            <div className="flex items-center gap-1 mr-2">
              {navLinks.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "text-[var(--accent)] bg-[var(--accent)]/10"
                        : "text-gray-300 hover:text-[var(--accent)] hover:bg-[var(--card-hover)]"
                    }`}
                  >
                    <span className="hidden lg:inline-flex">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Search */}
            <div ref={searchRef} className="relative">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  onKeyDown={(e) => e.key === "Escape" && setShowResults(false)}
                  placeholder="Search..."
                  className="bg-[var(--card-bg)] border border-[var(--card-border)] text-gray-100 placeholder-gray-500 text-sm pl-9 pr-3 py-2 rounded-lg w-44 focus:w-64 transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                />
              </div>
              {showResults && searchResults.length > 0 && (
                <ul className="absolute top-full right-0 mt-2 w-72 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto py-1">
                  {searchResults.map((r) => (
                    <li key={`${r.type}-${r.id}`}>
                      <Link
                        href={r.type === "person" ? `/profile/${r.id}` : `/family/${r.id}`}
                        onClick={() => {
                          setSearch("")
                          setShowResults(false)
                        }}
                        className="flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--card-hover)] text-sm transition-colors"
                      >
                        <span className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]/80 w-14">
                          {r.type}
                        </span>
                        <span className="text-gray-100 truncate">{r.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* User menu */}
            <div ref={userMenuRef} className="relative ml-2">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                className="w-9 h-9 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] font-semibold flex items-center justify-center hover:bg-[var(--accent)]/25 transition-colors duration-150"
              >
                {userInitial}
              </button>
              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-60 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--card-border)]">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Signed in as</p>
                    <p className="text-sm text-gray-100 truncate mt-0.5">{user.email}</p>
                  </div>
                  {myPersonId && (
                    <Link
                      href={`/profile/${myPersonId}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-[var(--card-hover)] hover:text-[var(--accent)] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-[var(--card-hover)] hover:text-[var(--accent)] transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile menu button */}
        {user && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-gray-300 hover:text-[var(--accent)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile drawer */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--card-border)] bg-[var(--background)]">
          <div className="container mx-auto px-4 py-4 space-y-4">
            {/* Mobile search */}
            <div ref={searchRef} className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onKeyDown={(e) => e.key === "Escape" && setShowResults(false)}
                placeholder="Search people & families..."
                className="bg-[var(--card-bg)] border border-[var(--card-border)] text-gray-100 placeholder-gray-500 text-base pl-9 pr-3 py-2.5 rounded-lg w-full focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
              {showResults && searchResults.length > 0 && (
                <ul className="absolute top-full left-0 right-0 mt-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto py-1">
                  {searchResults.map((r) => (
                    <li key={`${r.type}-${r.id}`}>
                      <Link
                        href={r.type === "person" ? `/profile/${r.id}` : `/family/${r.id}`}
                        onClick={() => {
                          setSearch("")
                          setShowResults(false)
                          setMobileMenuOpen(false)
                        }}
                        className="flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--card-hover)] text-sm transition-colors"
                      >
                        <span className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]/80 w-14">
                          {r.type}
                        </span>
                        <span className="text-gray-100 truncate">{r.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                      active
                        ? "text-[var(--accent)] bg-[var(--accent)]/10"
                        : "text-gray-200 hover:text-[var(--accent)] hover:bg-[var(--card-hover)]"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                )
              })}
            </div>

            <div className="pt-3 border-t border-[var(--card-border)] space-y-2">
              <div className="px-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Signed in as</p>
                <p className="text-sm text-gray-200 truncate mt-0.5">{user.email}</p>
              </div>
              {myPersonId && (
                <Link
                  href={`/profile/${myPersonId}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-base text-gray-200 hover:text-[var(--accent)] hover:bg-[var(--card-hover)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base text-gray-200 hover:text-[var(--accent)] hover:bg-[var(--card-hover)] transition-colors text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
