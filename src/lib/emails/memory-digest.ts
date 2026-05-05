import type { DigestEntry } from "@/utils/digest"

export interface DigestEmailInput {
  firstName: string
  totalReactions: number
  totalComments: number
  entries: DigestEntry[]
  unsubscribeUrl: string
  appUrl: string
}

function pluralize(count: number, word: string): string {
  if (count === 1) return `${count} ${word}`
  return `${count} ${word}s`
}

export function buildDigestSubject(input: {
  totalReactions: number
  totalComments: number
}): string {
  const parts: string[] = []
  if (input.totalReactions > 0) {
    parts.push(pluralize(input.totalReactions, "new reaction"))
  }
  if (input.totalComments > 0) {
    parts.push(pluralize(input.totalComments, "new comment"))
  }
  if (parts.length === 0) return "Activity on your memories"
  return `${parts.join(" and ")} on your memories`
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
  const actors =
    entry.actorNames.length === 0
      ? "Family members"
      : entry.actorNames.map(escapeHtml).join(", ")
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

export function buildDigestHtml(input: DigestEmailInput): string {
  const greetingName = input.firstName.trim() || "there"
  const summaryBits: string[] = []
  if (input.totalReactions > 0) {
    summaryBits.push(pluralize(input.totalReactions, "new reaction"))
  }
  if (input.totalComments > 0) {
    summaryBits.push(pluralize(input.totalComments, "new comment"))
  }
  const summary = summaryBits.join(" and ")
  const entriesHtml = input.entries.map(renderEntry).join("")

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 32px; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; background: #16213e; border-radius: 12px; padding: 32px; border: 1px solid #2a2a4a;">
        <h1 style="color: #ffffff; font-size: 22px; margin-top: 0;">Hi ${escapeHtml(greetingName)},</h1>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          You have <strong style="color: #4fc3f7;">${summary}</strong> on memories you posted to the family tree.
        </p>
        ${entriesHtml}
        <p style="font-size: 14px; color: #9e9e9e; margin: 24px 0 0;">
          <a href="${escapeHtml(input.appUrl)}" style="color: #4fc3f7; text-decoration: underline;">Open the family tree</a>
          to read replies and keep the conversation going.
        </p>
        <p style="font-size: 12px; color: #6e6e8e; margin-top: 32px;">
          You're receiving this because you've posted memories to the family tree.
          <a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #6e6e8e; text-decoration: underline;">Unsubscribe</a>.
        </p>
      </div>
    </body>
    </html>
  `
}
