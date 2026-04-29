import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import {
  buildMemoryInteractionNotificationHtml,
  buildMemoryInteractionSubject,
} from "@/lib/emails/memory-interaction-notification"
import { MEMORY_REACTION_EMOJIS } from "@/models/MemoryReaction"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

interface AuthedUser {
  id: string
  email?: string
}

interface NotifyInteractionPayload {
  memoryId: string
  actorUserId: string
  type: "reaction" | "comment"
  emoji?: string
  commentBody?: string
}

interface MemoryRecord {
  id: string
  title: string
  createdBy: string
}

interface PersonRecord {
  userId?: string
  firstName?: string
  lastName?: string
  email?: string
}

async function verifyUser(req: Request): Promise<AuthedUser | null> {
  const auth = req.headers.get("authorization") ?? ""
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${match[1]}`,
      },
    })
    if (!res.ok) return null

    const payload = (await res.json()) as { id?: unknown; email?: unknown }
    if (typeof payload.id !== "string") return null

    const user: AuthedUser = { id: payload.id }
    if (typeof payload.email === "string") user.email = payload.email
    return user
  } catch {
    return null
  }
}

async function supabaseGet<T>(path: string): Promise<T> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Supabase GET ${path} failed: ${res.status} ${errorText}`)
  }

  return (await res.json()) as T
}

async function getMemoryById(memoryId: string): Promise<MemoryRecord | null> {
  const params = new URLSearchParams({
    select: "id,title,createdBy",
    id: `eq.${memoryId}`,
    limit: "1",
  })
  const records = await supabaseGet<MemoryRecord[]>(`memories?${params}`)
  if (!records.length) return null
  return records[0]
}

async function getPersonByUserId(userId: string): Promise<PersonRecord | null> {
  const params = new URLSearchParams({
    select: "userId,firstName,lastName,email",
    userId: `eq.${userId}`,
    limit: "1",
  })
  const records = await supabaseGet<PersonRecord[]>(`people?${params}`)
  if (!records.length) return null
  return records[0]
}

function isValidPayload(payload: unknown): payload is NotifyInteractionPayload {
  if (!payload || typeof payload !== "object") return false

  const record = payload as Record<string, unknown>
  if (typeof record.memoryId !== "string" || !record.memoryId.trim()) return false
  if (typeof record.actorUserId !== "string" || !record.actorUserId.trim()) return false
  if (record.type !== "reaction" && record.type !== "comment") return false

  if (record.type === "reaction") {
    if (typeof record.emoji !== "string" || !record.emoji.trim()) return false
    if (!MEMORY_REACTION_EMOJIS.includes(record.emoji as (typeof MEMORY_REACTION_EMOJIS)[number])) {
      return false
    }
  }

  if (record.type === "comment") {
    if (typeof record.commentBody !== "string" || !record.commentBody.trim()) return false
  }

  return true
}

function personDisplayName(person: PersonRecord | null, fallbackEmail?: string): string {
  const firstName = person?.firstName?.trim() ?? ""
  const lastName = person?.lastName?.trim() ?? ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  if (fullName) return fullName
  if (fallbackEmail) return fallbackEmail.split("@")[0]
  return "Someone"
}

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !resendApiKey) {
    console.error("memory interaction notify missing required env vars")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const viewer = await verifyUser(request)
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await request.json()) as unknown
  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (payload.actorUserId !== viewer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const memory = await getMemoryById(payload.memoryId)
    if (!memory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 })
    }

    if (memory.createdBy === payload.actorUserId) {
      return NextResponse.json({ message: "Skipping self-notification" })
    }

    const owner = await getPersonByUserId(memory.createdBy)
    if (!owner?.email) {
      return NextResponse.json({ message: "Memory owner has no email" })
    }

    const actor = await getPersonByUserId(payload.actorUserId)
    const actorName = personDisplayName(actor, viewer.email)
    const resend = new Resend(resendApiKey)

    await resend.batch.send([
      {
        from: "Family Tree <onboarding@resend.dev>",
        to: owner.email,
        subject: buildMemoryInteractionSubject(memory.title),
        html: buildMemoryInteractionNotificationHtml({
          actorName,
          memoryTitle: memory.title,
          type: payload.type,
          emoji: payload.emoji,
          commentBody: payload.commentBody,
        }),
      },
    ])

    return NextResponse.json({ success: true, notified: 1 })
  } catch (error) {
    console.error("Failed to notify memory interaction:", error)
    return NextResponse.json(
      { error: "Failed to send memory interaction notification" },
      { status: 500 }
    )
  }
}
