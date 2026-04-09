import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { buildNewUserNotificationHtml } from "@/lib/emails/new-user-notification"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET || ""
const resend = new Resend(process.env.RESEND_API_KEY)

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  schema: string
  record: {
    id: string
    email: string
    raw_user_meta_data: {
      first_name?: string
      last_name?: string
    }
    created_at: string
  }
  old_record: null | Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret")
  if (secret !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await request.json()) as WebhookPayload

  if (payload.type !== "INSERT") {
    return NextResponse.json({ message: "Ignored non-INSERT event" })
  }

  const newUserEmail = payload.record.email
  const firstName =
    payload.record.raw_user_meta_data?.first_name || "Someone"
  const lastName = payload.record.raw_user_meta_data?.last_name || ""

  // Query all people with emails, excluding the new user
  const params = new URLSearchParams({
    select: "email",
    "email": `not.is.null`,
  })
  // Add filter to exclude new user's email
  params.append("email", `neq.${newUserEmail}`)

  const res = await fetch(`${supabaseUrl}/rest/v1/people?${params}`, {
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("Failed to query people:", err)
    return NextResponse.json(
      { error: "Failed to query recipients" },
      { status: 500 }
    )
  }

  const people = (await res.json()) as { email: string }[]
  const recipientEmails = [...new Set(people.map((p) => p.email))]

  if (recipientEmails.length === 0) {
    return NextResponse.json({ message: "No recipients to notify" })
  }

  const html = buildNewUserNotificationHtml(firstName, lastName)
  const subject = `${[firstName, lastName].filter(Boolean).join(" ")} just joined the family tree!`

  try {
    const BATCH_SIZE = 100
    for (let i = 0; i < recipientEmails.length; i += BATCH_SIZE) {
      const batch = recipientEmails.slice(i, i + BATCH_SIZE).map((email) => ({
        from: "Family Tree <onboarding@resend.dev>",
        to: email,
        subject,
        html,
      }))
      await resend.batch.send(batch)
    }

    return NextResponse.json({
      success: true,
      notified: recipientEmails.length,
    })
  } catch (err) {
    console.error("Failed to send emails:", err)
    return NextResponse.json(
      { error: "Failed to send notification emails" },
      { status: 500 }
    )
  }
}
