"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Person } from "@/models/Person";
import type { Family } from "@/models/Family";
import { Avatar, Icon, Wordmark } from "./ui";
import { escapeLikePattern } from "@/utils/likeEscape";

type NavLink = { href: string; label: string };

const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/family-tree", label: "People" },
  { href: "/timeline", label: "Timeline" },
  { href: "/places", label: "Places" },
  { href: "/memories", label: "Memories" },
  { href: "/events", label: "Events" },
  { href: "/families", label: "Families" },
];

type SearchResult = { type: "person" | "family"; id: string; label: string };

function readInitialTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("theme-dark") ? "dark" : "light";
}

export default function NavBar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Theme is set on <html> by ThemeScript pre-hydration; sync React state once mounted.
  useEffect(() => {
    setTheme(readInitialTheme());
  }, []);

  const isActive = (href: string) => {
    if (pathname === null) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Clear or reset state during render — rather than from inside effects that
  // would cascade an extra render — when an upstream value changes. Matches
  // the React 19 pattern used in MemoryImage / ProfileAvatar.
  const [prevSearchTrim, setPrevSearchTrim] = useState("");
  const trimmedSearch = search.trim();
  if (trimmedSearch !== prevSearchTrim) {
    setPrevSearchTrim(trimmedSearch);
    if (!trimmedSearch && searchResults.length > 0) setSearchResults([]);
  }

  const [prevUserId, setPrevUserId] = useState(user?.id ?? null);
  const currentUserId = user?.id ?? null;
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    if (!currentUserId && myPersonId !== null) setMyPersonId(null);
  }

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
    if (userMenuOpen) setUserMenuOpen(false);
    if (showResults) setShowResults(false);
  }

  // Debounced search across people + families
  useEffect(() => {
    if (!search.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const term = escapeLikePattern(search.toLowerCase());
      const [{ data: people }, { data: families }] = await Promise.all([
        supabase
          .from("people")
          .select("*")
          .ilike("searchName", `%${term}%`)
          .is("deletedAt", null)
          .limit(5),
        supabase
          .from("families")
          .select("*")
          .ilike("name", `%${term}%`)
          .is("deletedAt", null)
          .limit(3),
      ]);
      const results: SearchResult[] = [];
      if (people) {
        for (const p of people as Person[]) {
          results.push({ type: "person", id: p.id, label: `${p.firstName} ${p.lastName}` });
        }
      }
      if (families) {
        for (const f of families as Family[]) {
          results.push({ type: "family", id: f.id, label: f.name });
        }
      }
      setSearchResults(results);
      setShowResults(true);
    }, 300);
  }, [search]);

  // Resolve the signed-in user's person record so the menu can deep-link to their profile
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("people")
      .select("id")
      .eq("userId", user.id)
      .is("deletedAt", null)
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const first = Array.isArray(data) && data.length > 0 ? (data[0] as { id: string }) : null;
        setMyPersonId(first?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout failed", error);
      return;
    }
    router.push("/login");
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("theme-dark");
    }
    if (next === "light") {
      document.documentElement.classList.remove("theme-dark");
    }
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage unavailable; user just won't get persistence
    }
  };

  return (
    <nav
      className="sticky top-0 z-40"
      style={{
        background: "var(--paper)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-8" style={{ minHeight: 64 }}>
        <Link
          href="/"
          aria-label="Family Legacy — home"
          onClick={() => setMobileMenuOpen(false)}
          style={{ color: "var(--ink)", textDecoration: "none" }}
        >
          <Wordmark />
        </Link>

        {user ? (
          <>
            {/* Desktop nav links */}
            <div className="hidden items-center gap-0.5 md:flex">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full px-3.5 py-2 text-sm transition-colors duration-150"
                    style={{
                      color: active ? "var(--ink)" : "var(--ink-3)",
                      background: active ? "var(--paper-2)" : "transparent",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Desktop right cluster: search + theme + avatar */}
            <div className="hidden items-center gap-2.5 md:flex">
              <div ref={searchRef} className="relative">
                <div
                  className="flex items-center gap-2 rounded-full px-3.5 py-2"
                  style={{ background: "var(--paper-2)", minWidth: 220 }}
                >
                  <Icon name="search" size={14} style={{ color: "var(--ink-3)" }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    onKeyDown={(e) => e.key === "Escape" && setShowResults(false)}
                    placeholder="Search family, memories…"
                    className="flex-1 bg-transparent outline-none"
                    style={{ fontSize: 13, color: "var(--ink)" }}
                  />
                </div>
                {showResults && searchResults.length > 0 ? (
                  <ul
                    className="absolute right-0 top-full z-50 mt-2 max-h-72 w-72 overflow-y-auto rounded-xl py-1"
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--hairline)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {searchResults.map((r) => (
                      <li key={`${r.type}-${r.id}`}>
                        <Link
                          href={r.type === "person" ? `/profile/${r.id}` : `/families/${r.id}`}
                          onClick={() => {
                            setSearch("");
                            setShowResults(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors"
                          style={{ color: "var(--ink)", textDecoration: "none" }}
                        >
                          <span
                            className="eyebrow"
                            style={{ width: 56, color: "var(--sage-deep)" }}
                          >
                            {r.type}
                          </span>
                          <span className="truncate">{r.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 36,
                  height: 36,
                  background: "transparent",
                  border: "1px solid var(--hairline-strong)",
                  color: "var(--ink)",
                }}
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
              </button>

              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
                  className="rounded-full"
                >
                  <Avatar name={user.email ?? "?"} size={36} />
                </button>
                {userMenuOpen ? (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl py-1"
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--hairline)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
                      <p className="eyebrow">Signed in as</p>
                      <p className="mt-0.5 truncate text-sm" style={{ color: "var(--ink)" }}>
                        {user.email}
                      </p>
                    </div>
                    {myPersonId ? (
                      <Link
                        href={`/profile/${myPersonId}`}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                        style={{ color: "var(--ink-2)", textDecoration: "none" }}
                      >
                        <Icon name="people" size={16} />
                        My Profile
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors"
                      style={{ color: "var(--ink-2)", background: "transparent" }}
                    >
                      <Icon name="arrow" size={16} />
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full md:hidden"
              style={{ color: "var(--ink)", background: "transparent" }}
            >
              <Icon name={mobileMenuOpen ? "close" : "list"} size={20} />
            </button>
          </>
        ) : null}
      </div>

      {/* Mobile drawer */}
      {user && mobileMenuOpen ? (
        <div
          className="md:hidden"
          style={{ borderTop: "1px solid var(--hairline)", background: "var(--paper)" }}
        >
          <div className="space-y-4 px-6 py-4">
            <div className="relative">
              <div
                className="flex items-center gap-2 rounded-full px-3.5 py-2.5"
                style={{ background: "var(--paper-2)" }}
              >
                <Icon name="search" size={14} style={{ color: "var(--ink-3)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search family, memories…"
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 14, color: "var(--ink)" }}
                />
              </div>
              {showResults && searchResults.length > 0 ? (
                <ul
                  className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl py-1"
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--hairline)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {searchResults.map((r) => (
                    <li key={`${r.type}-${r.id}`}>
                      <Link
                        href={r.type === "person" ? `/profile/${r.id}` : `/families/${r.id}`}
                        onClick={() => {
                          setSearch("");
                          setShowResults(false);
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors"
                        style={{ color: "var(--ink)", textDecoration: "none" }}
                      >
                        <span className="eyebrow" style={{ width: 56, color: "var(--sage-deep)" }}>
                          {r.type}
                        </span>
                        <span className="truncate">{r.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-full px-4 py-2.5 text-base transition-colors"
                    style={{
                      color: active ? "var(--ink)" : "var(--ink-2)",
                      background: active ? "var(--paper-2)" : "transparent",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--hairline)" }}>
              <div className="px-4">
                <p className="eyebrow">Signed in as</p>
                <p className="mt-0.5 truncate text-sm" style={{ color: "var(--ink)" }}>
                  {user.email}
                </p>
              </div>
              <div className="flex items-center gap-2 px-4">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    background: "transparent",
                    border: "1px solid var(--hairline-strong)",
                    color: "var(--ink)",
                  }}
                >
                  <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
                </button>
                <span className="text-sm" style={{ color: "var(--ink-3)" }}>
                  {theme === "dark" ? "Dark" : "Light"} theme
                </span>
              </div>
              {myPersonId ? (
                <Link
                  href={`/profile/${myPersonId}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-full px-4 py-2.5 text-base transition-colors"
                  style={{ color: "var(--ink-2)", textDecoration: "none" }}
                >
                  <Icon name="people" size={16} />
                  My Profile
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-base transition-colors"
                style={{ color: "var(--ink-2)", background: "transparent" }}
              >
                <Icon name="arrow" size={16} />
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
