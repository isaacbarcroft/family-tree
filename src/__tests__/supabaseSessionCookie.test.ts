import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AUTH_INDICATOR_COOKIE } from "@/config/constants"

// These tests exercise the side effect of `supabase.auth.signInWithPassword`
// and `supabase.auth.signOut` writing / clearing the presence cookie that
// `src/middleware.ts` reads to gate page navigation. The session is still
// kept in localStorage as before; the cookie is purely a defense-in-depth
// indicator for the edge middleware.

const ORIGINAL_ENV = { ...process.env }
const STORAGE_KEY = "family_tree_supabase_session"

function clearCookies() {
  // Wipe any leftover cookies set by other tests in this file. jsdom keeps
  // cookies on `document.cookie` across `it` blocks.
  if (typeof document === "undefined") return
  const existing = document.cookie.split(";")
  for (const entry of existing) {
    const name = entry.split("=")[0]?.trim()
    if (!name) continue
    document.cookie = `${name}=; Path=/; Max-Age=0`
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  for (const entry of document.cookie.split(";")) {
    const [k, v] = entry.split("=")
    if (k?.trim() === name) return v ?? ""
  }
  return null
}

function mockSignInResponse() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        refresh_token: "refresh-abc",
        user: { id: "u1", email: "u1@example.com" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  )
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

async function loadModule() {
  vi.resetModules()
  const mod = await import("@/lib/supabase")
  return mod
}

describe("supabase auth presence cookie", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    window.localStorage.clear()
    clearCookies()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
    window.localStorage.clear()
    clearCookies()
  })

  it("writes the AUTH_INDICATOR_COOKIE to '1' after signInWithPassword succeeds", async () => {
    mockSignInResponse()
    const { supabase } = await loadModule()

    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBeNull()

    const result = await supabase.auth.signInWithPassword({
      email: "u1@example.com",
      password: "pw",
    })
    expect(result.error).toBeNull()

    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBe("1")
    // The localStorage write must still happen alongside the cookie. The
    // cookie is a presence indicator only; the actual session lives in
    // localStorage so the in-page Supabase client can read it.
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it("clears the AUTH_INDICATOR_COOKIE after signOut", async () => {
    mockSignInResponse()
    const { supabase } = await loadModule()
    await supabase.auth.signInWithPassword({ email: "u1@example.com", password: "pw" })
    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBe("1")

    // Signing out fires its own fetch to /auth/v1/logout; the cookie must
    // be cleared even if that call errors, so let the fetch succeed here
    // and then assert the cookie is gone.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
    const out = await supabase.auth.signOut()
    expect(out.error).toBeNull()

    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("clears the AUTH_INDICATOR_COOKIE if the network logout call throws", async () => {
    mockSignInResponse()
    const { supabase } = await loadModule()
    await supabase.auth.signInWithPassword({ email: "u1@example.com", password: "pw" })
    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBe("1")

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"))
    const out = await supabase.auth.signOut()
    expect(out.error).toBeNull()

    // Network failure must not strand the user in a "looks signed in to
    // middleware but signed out to AuthProvider" state.
    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("syncs the cookie from a pre-existing localStorage session at module load (legacy migration)", async () => {
    // Simulate a user who was signed in before the cookie existed: their
    // localStorage already holds a valid session, but document.cookie does
    // not. Importing the module must self-heal by writing the cookie so
    // the middleware doesn't bounce them to /login.
    const validToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        access_token: validToken,
        refresh_token: "r",
        user: { id: "u1" },
      }),
    )
    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBeNull()

    await loadModule()

    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBe("1")
  })

  it("clears the cookie at module load if the stored session is expired", async () => {
    // Stale session with `exp` in the past: the migration block must not
    // paper over an expired token by writing the cookie. RLS would refuse
    // the calls anyway, but a stale cookie would let the empty page shell
    // render and flash.
    const expiredToken = makeJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        access_token: expiredToken,
        refresh_token: "r",
        user: { id: "u1" },
      }),
    )
    // Pre-seed the cookie to a stale "1" to prove the migration overwrites it.
    document.cookie = `${AUTH_INDICATOR_COOKIE}=1; Path=/`

    await loadModule()

    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBeNull()
  })

  it("does not throw at module load when there is no stored session", async () => {
    // Brand-new browser, no localStorage. Module import must succeed and
    // simply leave the cookie absent.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()

    await expect(loadModule()).resolves.toBeDefined()

    expect(readCookie(AUTH_INDICATOR_COOKIE)).toBeNull()
  })

  it("writes the cookie with Path=/ and SameSite=Lax so middleware sees it on every navigation", async () => {
    // jsdom strips cookie attributes when read via document.cookie, but we
    // can intercept the setter to capture the raw header value we wrote.
    const writes: string[] = []
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        return desc?.get?.call(document) ?? ""
      },
      set(value: string) {
        writes.push(value)
        desc?.set?.call(document, value)
      },
    })

    try {
      mockSignInResponse()
      const { supabase } = await loadModule()
      await supabase.auth.signInWithPassword({ email: "u1@example.com", password: "pw" })

      const signInWrite = writes.find(
        (w) => w.startsWith(`${AUTH_INDICATOR_COOKIE}=1`) && !w.includes("Max-Age=0"),
      )
      expect(signInWrite).toBeDefined()
      expect(signInWrite).toContain("Path=/")
      expect(signInWrite).toContain("SameSite=Lax")
      // Tests run under jsdom's default `http://localhost` origin, so the
      // Secure flag must NOT be present — otherwise the cookie would be
      // rejected during local dev and the middleware gate would break.
      expect(signInWrite).not.toContain("Secure")
    } finally {
      if (desc) Object.defineProperty(document, "cookie", desc)
    }
  })
})
