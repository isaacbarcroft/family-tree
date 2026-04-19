/**
 * Extract a human-readable message from a caught error of unknown shape.
 *
 * Handles the shapes we actually see in this codebase:
 * - Error instances thrown by application code
 * - `{ message, status }` objects thrown by the Supabase REST client
 *   (see `normalizeError` in `@/lib/supabase`)
 * - Raw strings
 *
 * Falls back to `fallback` for any other shape or when the extracted
 * message is blank, so user-facing error UI always shows something.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message.trim() || fallback
  }

  if (typeof err === "string") {
    return err.trim() || fallback
  }

  if (typeof err === "object" && err !== null && "message" in err) {
    const raw = (err as { message: unknown }).message
    if (typeof raw === "string" && raw.trim()) return raw.trim()
  }

  return fallback
}
