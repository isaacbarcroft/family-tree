import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { proxy, config } from "@/proxy"
import { AUTH_INDICATOR_COOKIE } from "@/config/constants"

// Edge-level auth gate. The matcher already filters out static assets, so
// these tests assume the proxy actually ran and only check the routing
// decision the function makes. (Next 16 renamed the `middleware` file
// convention to `proxy` — same edge runtime, same API.)

function buildRequest(pathname: string, opts: { authed?: boolean; search?: string } = {}) {
  const url = new URL(`http://localhost${pathname}${opts.search ?? ""}`)
  const headers = new Headers()
  if (opts.authed) {
    headers.set("cookie", `${AUTH_INDICATOR_COOKIE}=1`)
  }
  return new NextRequest(url, { headers })
}

describe("proxy", () => {
  describe("public paths (must remain reachable without a session)", () => {
    it.each([
      "/login",
      "/signup",
      "/auth/callback",
      "/forgot-password",
      "/reset-password",
    ])("lets %s through when unauthenticated", (path) => {
      const res = proxy(buildRequest(path))
      // NextResponse.next() doesn't set a Location header and has no
      // redirect-class status code. Both `next()` and `redirect()` return a
      // NextResponse, so we discriminate on the presence of a Location.
      expect(res.headers.get("location")).toBeNull()
    })

    it("lets /api/webhooks/* through without a session", () => {
      const res = proxy(buildRequest("/api/webhooks/new-user"))
      expect(res.headers.get("location")).toBeNull()
    })

    it("lets /api/notifications/unsubscribe through without a session (token-driven)", () => {
      const res = proxy(buildRequest("/api/notifications/unsubscribe", { search: "?token=abc" }))
      expect(res.headers.get("location")).toBeNull()
    })

    it("lets /api/* in general through (routes manage their own auth)", () => {
      const res = proxy(buildRequest("/api/geocode"))
      expect(res.headers.get("location")).toBeNull()
    })
  })

  describe("protected page paths (require the auth cookie)", () => {
    it("redirects to /login when no cookie is present", () => {
      const res = proxy(buildRequest("/family-tree"))
      const location = res.headers.get("location")
      expect(location).toBeTruthy()
      const url = new URL(location!)
      expect(url.pathname).toBe("/login")
    })

    it("preserves the original destination as ?next= so the login page can route back", () => {
      const res = proxy(buildRequest("/profile/abc-123", { search: "?tab=memories" }))
      const url = new URL(res.headers.get("location")!)
      expect(url.pathname).toBe("/login")
      const nextParam = url.searchParams.get("next")
      expect(nextParam).toBe("/profile/abc-123?tab=memories")
    })

    it("URL-encodes the next parameter so query strings round-trip safely", () => {
      const res = proxy(buildRequest("/places", { search: "?q=hello%20world&zoom=12" }))
      const url = new URL(res.headers.get("location")!)
      // The encoded `next` must contain the literal `?` separator, not a
      // double-encoded `%3F` — otherwise the login page can't parse it back.
      expect(url.searchParams.get("next")).toBe("/places?q=hello%20world&zoom=12")
    })

    it("returns a 3xx redirect status (not a 200 next())", () => {
      const res = proxy(buildRequest("/memories"))
      // NextResponse.redirect emits 307 by default.
      expect(res.status).toBeGreaterThanOrEqual(300)
      expect(res.status).toBeLessThan(400)
    })
  })

  describe("with the auth cookie present", () => {
    it("lets the request through to a protected page", () => {
      const res = proxy(buildRequest("/family-tree", { authed: true }))
      expect(res.headers.get("location")).toBeNull()
    })

    it.each(["/profile/123", "/memories", "/events", "/families", "/places", "/timeline", "/admin/seed"])(
      "lets %s through when authed",
      (path) => {
        const res = proxy(buildRequest(path, { authed: true }))
        expect(res.headers.get("location")).toBeNull()
      },
    )

    it("does not redirect when the cookie holds an unexpected value (treats it as absent)", () => {
      // Forging the cookie name with a non-"1" value should fall through to
      // the redirect path; the gate is a strict equality check.
      const url = new URL("http://localhost/family-tree")
      const headers = new Headers({ cookie: `${AUTH_INDICATOR_COOKIE}=stale-value` })
      const req = new NextRequest(url, { headers })
      const res = proxy(req)
      expect(res.headers.get("location")).toBeTruthy()
    })
  })

  describe("matcher config", () => {
    it("exposes a matcher array so the proxy runs on browser navigations", () => {
      expect(Array.isArray(config.matcher)).toBe(true)
      expect(config.matcher.length).toBeGreaterThan(0)
    })

    it("excludes _next/ chunks and the favicon at the matcher level", () => {
      // Regression pin: the matcher must skip Next internals so we never run
      // the auth gate against bundle chunks during page navigation. The
      // expression is checked literally so a careless rewrite is caught.
      const expr = config.matcher[0]
      expect(expr).toContain("_next/")
      expect(expr).toContain("favicon")
    })
  })
})
