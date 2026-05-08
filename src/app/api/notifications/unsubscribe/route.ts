import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface AppUserRow {
  userId: string
  notificationPrefs: Record<string, unknown> | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function htmlPage(
  title: string,
  message: string,
  status: number
): NextResponse {
  const body = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 48px 16px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #16213e; border-radius: 12px; padding: 32px; border: 1px solid #2a2a4a; text-align: center;">
    <h1 style="color: #ffffff; font-size: 22px; margin-top: 0;">${title}</h1>
    <p style="font-size: 16px; line-height: 1.6;">${message}</p>
  </div>
</body>
</html>`
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("unsubscribe route missing required env vars")
    return htmlPage(
      "Unsubscribe unavailable",
      "The server is misconfigured. Please reply to this email and we'll remove you manually.",
      500
    )
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || !UUID_RE.test(token)) {
    return htmlPage(
      "Invalid unsubscribe link",
      "This link is missing or malformed. Please reply to your most recent digest email and we'll remove you manually.",
      400
    )
  }

  const lookupRes = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=userId,notificationPrefs&unsubscribeToken=eq.${encodeURIComponent(token)}`,
    {
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
    }
  )
  if (!lookupRes.ok) {
    console.error("unsubscribe lookup failed", lookupRes.status)
    return htmlPage(
      "Something went wrong",
      "We couldn't process your unsubscribe right now. Please try again in a few minutes.",
      500
    )
  }
  const rows = (await lookupRes.json()) as AppUserRow[]
  if (rows.length === 0) {
    return htmlPage(
      "Already unsubscribed",
      "This unsubscribe link has already been used or is no longer valid. You won't receive further digests.",
      200
    )
  }

  const row = rows[0]
  const currentPrefs =
    row.notificationPrefs && typeof row.notificationPrefs === "object"
      ? row.notificationPrefs
      : {}
  const nextPrefs = { ...currentPrefs, digest: "off" }

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/app_users?userId=eq.${encodeURIComponent(row.userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ notificationPrefs: nextPrefs }),
    }
  )
  if (!updateRes.ok) {
    console.error("unsubscribe update failed", updateRes.status)
    return htmlPage(
      "Something went wrong",
      "We couldn't save your preference. Please try again in a few minutes.",
      500
    )
  }

  return htmlPage(
    "You're unsubscribed",
    "We won't email you about reactions or comments anymore. You can re-enable notifications anytime by editing your profile settings.",
    200
  )
}
