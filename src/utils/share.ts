// Web Share API helper with clipboard fallback. Used by invite buttons so
// the recipient gets explanatory text alongside the URL instead of a bare
// link with no context.

export type InviteShare = {
  title: string
  text: string
  url: string
}

export type ShareResult = "shared" | "copied" | "cancelled"

export async function shareInvite(payload: InviteShare): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const canShare = navigator.canShare?.(payload) ?? true
    if (canShare) {
      try {
        await navigator.share(payload)
        return "shared"
      } catch (err) {
        // AbortError = user dismissed the sheet — treat as cancel, not failure.
        if (err instanceof DOMException && err.name === "AbortError") return "cancelled"
        // Any other share failure falls through to clipboard.
      }
    }
  }
  await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`)
  return "copied"
}
