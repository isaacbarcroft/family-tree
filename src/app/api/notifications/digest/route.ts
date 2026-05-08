import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import {
  buildDigests,
  normalizePrefs,
  type DigestActorName,
  type DigestCommentRow,
  type DigestEventRow,
  type DigestForRecipient,
  type DigestMemoryRow,
  type DigestPersonRow,
  type DigestReactionRow,
  type DigestRecipient,
} from "@/utils/digest"
import {
  buildDigestHtml,
  buildDigestSubject,
} from "@/lib/emails/memory-digest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RESEND_FROM = "Family Tree <onboarding@resend.dev>"
const RESEND_BATCH_SIZE = 100

interface AppUserRow {
  userId: string
  notificationPrefs: unknown
  lastDigestSentAt: string | null
  unsubscribeToken: string
  createdAt: string
}

interface AuthUserRow {
  id: string
  email: string | null
  raw_user_meta_data: { first_name?: string; last_name?: string } | null
}

interface PersonRow {
  id: string
  userId: string | null
  firstName: string | null
  lastName: string | null
  birthDate: string | null
  deathDate: string | null
}

async function supabaseGet<T>(
  supabaseUrl: string,
  serviceKey: string,
  path: string
): Promise<T> {
  const res = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Supabase GET ${path} failed: ${res.status} ${body.slice(0, 200)}`
    )
  }
  return (await res.json()) as T
}

async function supabasePatch(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  body: unknown
): Promise<void> {
  const res = await fetch(`${supabaseUrl}${path}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(
      `Supabase PATCH ${path} failed: ${res.status} ${errBody.slice(0, 200)}`
    )
  }
}

interface AuthAdminListResponse {
  users: AuthUserRow[]
}

async function fetchAuthUsersByIds(
  supabaseUrl: string,
  serviceKey: string,
  ids: string[]
): Promise<AuthUserRow[]> {
  if (ids.length === 0) return []
  // The /auth/v1/admin/users endpoint doesn't accept arbitrary filters, so
  // pull pages and filter in-process. Single-family scale (<= a few hundred
  // approved users) makes this trivial.
  const collected: AuthUserRow[] = []
  const wantedIds = new Set(ids)
  let page = 1
  const perPage = 200
  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    })
    const url = `${supabaseUrl}/auth/v1/admin/users?${params}`
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(
        `Auth admin list failed: ${res.status} ${body.slice(0, 200)}`
      )
    }
    const json = (await res.json()) as AuthAdminListResponse
    const users = Array.isArray(json.users) ? json.users : []
    for (const u of users) {
      if (wantedIds.has(u.id)) collected.push(u)
    }
    if (users.length < perPage) break
    if (collected.length >= wantedIds.size) break
    page += 1
  }
  return collected
}

function appBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ""
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  return "https://example.com"
}

function unsubscribeUrlFor(token: string): string {
  return `${appBaseUrl()}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const cronSecret = process.env.DIGEST_CRON_SECRET
  const resendApiKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !supabaseServiceKey || !cronSecret || !resendApiKey) {
    console.error("digest route missing required env vars")
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    )
  }

  const provided = request.headers.get("x-cron-secret")
  if (provided !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 1. Load every approved user with prefs + last-sent + unsubscribe token.
  const appUsers = await supabaseGet<AppUserRow[]>(
    supabaseUrl,
    supabaseServiceKey,
    `/rest/v1/app_users?select=userId,notificationPrefs,lastDigestSentAt,unsubscribeToken,createdAt`
  )
  if (appUsers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 })
  }

  // 2. Load the full family-scale datasets once. The digest builder handles
  //    per-user filtering, cadence windows, birthdays, and anniversaries.
  const [reactions, comments, memories, events, peopleRows] = await Promise.all([
    supabaseGet<DigestReactionRow[]>(
      supabaseUrl,
      supabaseServiceKey,
      `/rest/v1/memory_reactions?select=memoryId,userId,emoji,createdAt`
    ),
    supabaseGet<DigestCommentRow[]>(
      supabaseUrl,
      supabaseServiceKey,
      `/rest/v1/memory_comments?select=memoryId,userId,body,createdAt`
    ),
    supabaseGet<DigestMemoryRow[]>(
      supabaseUrl,
      supabaseServiceKey,
      `/rest/v1/memories?select=id,title,date,createdBy&deletedAt=is.null`
    ),
    supabaseGet<DigestEventRow[]>(
      supabaseUrl,
      supabaseServiceKey,
      `/rest/v1/events?select=id,title,date&deletedAt=is.null`
    ),
    supabaseGet<PersonRow[]>(
      supabaseUrl,
      supabaseServiceKey,
      `/rest/v1/people?select=id,userId,firstName,lastName,birthDate,deathDate&deletedAt=is.null`
    ),
  ])

  const people: DigestPersonRow[] = peopleRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate,
    deathDate: row.deathDate,
  }))

  const actorNames: DigestActorName[] = []
  for (const person of people) {
    if (typeof person.userId !== "string" || person.userId.length === 0) {
      continue
    }

    const displayName =
      [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
      "A family member"
    actorNames.push({
      userId: person.userId,
      displayName,
    })
  }

  // 3. Look up auth users to get email + first name for the recipients.
  const recipientIds = appUsers.map((u) => u.userId)
  const authUsers = await fetchAuthUsersByIds(
    supabaseUrl,
    supabaseServiceKey,
    recipientIds
  )
  const authById = new Map<string, AuthUserRow>()
  for (const u of authUsers) authById.set(u.id, u)

  const recipients: DigestRecipient[] = []
  for (const u of appUsers) {
    const auth = authById.get(u.userId)
    if (!auth || !auth.email) continue
    recipients.push({
      userId: u.userId,
      email: auth.email,
      prefs: normalizePrefs(u.notificationPrefs),
      unsubscribeToken: u.unsubscribeToken,
      lastDigestSentAt: u.lastDigestSentAt,
      createdAt: u.createdAt,
    })
  }

  const now = new Date()
  const digests = buildDigests({
    recipients,
    memories,
    events,
    people,
    reactions,
    comments,
    actorNames,
    now,
  })

  if (digests.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: appUsers.length })
  }

  const resend = new Resend(resendApiKey)
  let sent = 0
  for (let i = 0; i < digests.length; i += RESEND_BATCH_SIZE) {
    const batch = digests.slice(i, i + RESEND_BATCH_SIZE)
    const payload = batch.map((d) => emailFor(d, authById))
    try {
      await resend.batch.send(payload)
      sent += batch.length
    } catch (err) {
      console.error("digest batch failed", err)
      return NextResponse.json(
        { error: "Failed to send digest", sent },
        { status: 500 }
      )
    }
  }

  // 4. Stamp lastDigestSentAt for everyone we successfully emailed. PATCH
  //    one user at a time to keep the JSON body small and the failure mode
  //    obvious; single-family scale makes the round-trip count irrelevant.
  const stampIso = now.toISOString()
  for (const d of digests) {
    try {
      await supabasePatch(
        supabaseUrl,
        supabaseServiceKey,
        `/rest/v1/app_users?userId=eq.${encodeURIComponent(d.recipient.userId)}`,
        { lastDigestSentAt: stampIso }
      )
    } catch (err) {
      console.error("digest stamp failed", d.recipient.userId, err)
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped: appUsers.length - sent,
  })
}

function emailFor(
  digest: DigestForRecipient,
  authById: Map<string, AuthUserRow>
): {
  from: string
  to: string
  subject: string
  html: string
} {
  const auth = authById.get(digest.recipient.userId)
  const firstName =
    auth?.raw_user_meta_data?.first_name ??
    digest.recipient.email.split("@")[0]
  return {
    from: RESEND_FROM,
    to: digest.recipient.email,
    subject: buildDigestSubject({
      totalReactions: digest.totalReactions,
      totalComments: digest.totalComments,
      totalBirthdays: digest.totalBirthdays,
      totalAnniversaries: digest.totalAnniversaries,
    }),
    html: buildDigestHtml({
      firstName,
      totalReactions: digest.totalReactions,
      totalComments: digest.totalComments,
      totalBirthdays: digest.totalBirthdays,
      totalAnniversaries: digest.totalAnniversaries,
      entries: digest.entries,
      birthdays: digest.birthdays,
      anniversaries: digest.anniversaries,
      unsubscribeUrl: unsubscribeUrlFor(digest.recipient.unsubscribeToken),
      appUrl: appBaseUrl(),
    }),
  }
}
