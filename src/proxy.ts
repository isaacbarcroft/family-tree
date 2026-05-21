import { NextResponse, type NextRequest } from "next/server"
import { AUTH_INDICATOR_COOKIE } from "@/config/constants"

// Next 16 renamed the `middleware` file convention to `proxy` (same edge
// runtime, same API surface, clearer name). See:
// https://nextjs.org/docs/messages/middleware-to-proxy

// Routes that must remain reachable without a session. These are the auth /
// recovery flows themselves plus the email-token-driven unsubscribe endpoint
// (which must work for signed-out recipients clicking a digest link).
const PUBLIC_PAGE_PATHS = new Set([
  "/login",
  "/signup",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGE_PATHS.has(pathname)) return true

  // API routes manage their own auth contract — `verifyUser` on the
  // privileged routes (`/api/convert-image`, `/api/geocode`), `x-cron-secret`
  // on `/api/notifications/digest`, `x-webhook-secret` on `/api/webhooks/*`,
  // token-based on `/api/notifications/unsubscribe`, NODE_ENV gate on
  // `/api/seed`. Letting them through here keeps the proxy focused on
  // browser navigation; unauthenticated callers still get 401 / 404 from
  // the route or RLS itself.
  if (pathname.startsWith("/api/")) return true

  return false
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const hasAuthCookie = request.cookies.get(AUTH_INDICATOR_COOKIE)?.value === "1"
  if (hasAuthCookie) {
    return NextResponse.next()
  }

  // Preserve the original destination so /login can route back after sign-in.
  // The login page does not yet honor `?next=`; this is forward-compatible
  // and gives a logged-out deep link a chance to round-trip later.
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Skip Next internals and static assets at the matcher level so the proxy
  // never runs for chunked bundles, the favicon, or any file with an
  // extension (e.g. images, fonts) served from /public.
  matcher: ["/((?!_next/|favicon\\.ico|.*\\.).*)"],
}
