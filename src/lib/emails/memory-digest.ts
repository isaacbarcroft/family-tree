import { formatDate } from "@/utils/dates"
import type {
  DigestAnniversaryEntry,
  DigestBirthdayEntry,
  DigestEntry,
} from "@/utils/digest"

export interface DigestEmailInput {
  firstName: string
  totalReactions: number
  totalComments: number
  totalBirthdays: number
  totalAnniversaries: number
  entries: DigestEntry[]
  birthdays: DigestBirthdayEntry[]
  anniversaries: DigestAnniversaryEntry[]
  unsubscribeUrl: string
  appUrl: string
}

function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`
  if (plural) return `${count} ${plural}`
  return `${count} ${singular}s`
}

export function buildDigestSubject(input: {
  totalReactions: number
  totalComments: number
  totalBirthdays: number
  totalAnniversaries: number
}): string {
  const parts: string[] = []
  if (input.totalReactions > 0) {
    parts.push(pluralize(input.totalReactions, "new reaction"))
  }
  if (input.totalComments > 0) {
    parts.push(pluralize(input.totalComments, "new comment"))
  }
  if (input.totalBirthdays > 0) {
    parts.push(pluralize(input.totalBirthdays, "birthday", "birthdays"))
  }
  if (input.totalAnniversaries > 0) {
    parts.push(
      pluralize(
        input.totalAnniversaries,
        "family anniversary",
        "family anniversaries"
      )
    )
  }
  if (parts.length === 0) return "Updates from your family tree"
  return `${parts.join(" and ")} in your family tree`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderEntry(entry: DigestEntry): string {
  let actors = "Family members"
  if (entry.actorNames.length > 0) {
    actors = entry.actorNames.map(escapeHtml).join(", ")
  }
  const bits: string[] = []
  if (entry.reactionCount > 0) {
    bits.push(pluralize(entry.reactionCount, "reaction"))
  }
  if (entry.commentCount > 0) {
    bits.push(pluralize(entry.commentCount, "comment"))
  }
  const summary = bits.join(" and ")
  return `
    <div style="padding: 16px 0; border-bottom: 1px solid #2a2a4a;">
      <div style="color: #ffffff; font-size: 16px; font-weight: 600; margin-bottom: 4px;">
        ${escapeHtml(entry.memoryTitle)}
      </div>
      <div style="color: #b8b8d8; font-size: 14px;">
        ${actors} left ${summary}.
      </div>
    </div>
  `
}

function renderBirthdays(entries: DigestBirthdayEntry[]): string {
  if (entries.length === 0) return ""

  const rows = entries.map((entry) => {
    let ageText = ""
    if (entry.age !== null) {
      ageText = ` turns ${entry.age}`
    }
    return `
      <div style="padding: 12px 0; border-bottom: 1px solid #2a2a4a;">
        <div style="color: #ffffff; font-size: 15px; font-weight: 600;">
          ${escapeHtml(entry.displayName)}${ageText}
        </div>
        <div style="color: #b8b8d8; font-size: 14px;">
          ${escapeHtml(formatDate(entry.occurrenceDate))}
        </div>
      </div>
    `
  })

  return `
    <div style="margin-top: 32px;">
      <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 8px;">Family birthdays</h2>
      ${rows.join("")}
    </div>
  `
}

function renderAnniversaries(entries: DigestAnniversaryEntry[]): string {
  if (entries.length === 0) return ""

  const rows = entries.map((entry) => {
    let kindLabel = "Memory"
    if (entry.kind === "event") {
      kindLabel = "Event"
    }
    return `
      <div style="padding: 12px 0; border-bottom: 1px solid #2a2a4a;">
        <div style="color: #ffffff; font-size: 15px; font-weight: 600;">
          ${escapeHtml(entry.title)}
        </div>
        <div style="color: #b8b8d8; font-size: 14px;">
          ${kindLabel} from ${entry.yearsAgo} years ago, originally ${escapeHtml(formatDate(entry.originalDate))}
        </div>
      </div>
    `
  })

  return `
    <div style="margin-top: 32px;">
      <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 8px;">On this day</h2>
      ${rows.join("")}
    </div>
  `
}

export function buildDigestHtml(input: DigestEmailInput): string {
  const greetingName = input.firstName.trim() || "there"
  const summaryBits: string[] = []
  if (input.totalReactions > 0) {
    summaryBits.push(pluralize(input.totalReactions, "new reaction"))
  }
  if (input.totalComments > 0) {
    summaryBits.push(pluralize(input.totalComments, "new comment"))
  }
  if (input.totalBirthdays > 0) {
    summaryBits.push(pluralize(input.totalBirthdays, "birthday", "birthdays"))
  }
  if (input.totalAnniversaries > 0) {
    summaryBits.push(
      pluralize(
        input.totalAnniversaries,
        "family anniversary",
        "family anniversaries"
      )
    )
  }
  let summary = summaryBits.join(" and ")
  if (!summary) {
    summary = "updates waiting for you"
  }
  const entriesHtml = input.entries.map(renderEntry).join("")
  const birthdaysHtml = renderBirthdays(input.birthdays)
  const anniversariesHtml = renderAnniversaries(input.anniversaries)
  let activitySection = ""
  if (entriesHtml) {
    activitySection = `
      <div style="margin-top: 32px;">
        <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 8px;">New activity on your memories</h2>
        ${entriesHtml}
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 32px; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; background: #16213e; border-radius: 12px; padding: 32px; border: 1px solid #2a2a4a;">
        <h1 style="color: #ffffff; font-size: 22px; margin-top: 0;">Hi ${escapeHtml(greetingName)},</h1>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Here are <strong style="color: #4fc3f7;">${summary}</strong> from your family tree.
        </p>
        ${birthdaysHtml}
        ${anniversariesHtml}
        ${activitySection}
        <p style="font-size: 14px; color: #9e9e9e; margin: 24px 0 0;">
          <a href="${escapeHtml(input.appUrl)}" style="color: #4fc3f7; text-decoration: underline;">Open the family tree</a>
          to read replies, revisit memories, and keep the conversation going.
        </p>
        <p style="font-size: 12px; color: #6e6e8e; margin-top: 32px;">
          You're receiving this because you're part of the family tree.
          <a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #6e6e8e; text-decoration: underline;">Unsubscribe</a>.
        </p>
      </div>
    </body>
    </html>
  `
}
