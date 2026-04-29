interface MemoryInteractionNotificationEmail {
  actorName: string
  memoryTitle: string
  type: "reaction" | "comment"
  emoji?: string
  commentBody?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildMemoryInteractionSubject(memoryTitle: string): string {
  return `New activity on "${memoryTitle}"`
}

function truncateComment(commentBody: string): string {
  const trimmed = commentBody.trim()
  if (trimmed.length <= 180) return trimmed
  return `${trimmed.slice(0, 177)}...`
}

export function buildMemoryInteractionNotificationHtml(
  input: MemoryInteractionNotificationEmail
): string {
  const actorName = escapeHtml(input.actorName)
  const memoryTitle = escapeHtml(input.memoryTitle)

  let intro = `<strong style="color: #4fc3f7;">${actorName}</strong> added a note on <strong style="color: #ffffff;">${memoryTitle}</strong>.`
  if (input.type === "reaction") {
    intro = `<strong style="color: #4fc3f7;">${actorName}</strong> reacted ${input.emoji ?? ""} to <strong style="color: #ffffff;">${memoryTitle}</strong>.`
  }

  let commentBlock = ""
  if (input.type === "comment" && input.commentBody) {
    const commentBody = escapeHtml(truncateComment(input.commentBody))
    commentBlock = `
      <div style="margin-top: 20px; padding: 16px; border-radius: 10px; background: #0f172a; border: 1px solid #334155;">
        <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.6; white-space: pre-line;">${commentBody}</p>
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 32px; margin: 0;">
      <div style="max-width: 520px; margin: 0 auto; background: #16213e; border-radius: 12px; padding: 32px; border: 1px solid #2a2a4a;">
        <h1 style="color: #ffffff; font-size: 22px; margin-top: 0;">Memory update</h1>
        <p style="font-size: 16px; line-height: 1.7; margin-bottom: 0;">
          ${intro}
        </p>
        ${commentBlock}
        <p style="font-size: 14px; color: #9e9e9e; margin-top: 24px; margin-bottom: 0;">
          Open the family tree to join the conversation.
        </p>
      </div>
    </body>
    </html>
  `
}
