/**
 * Format a date string for display, avoiding timezone shift issues.
 *
 * Date-only strings like "1992-08-20" are parsed as UTC midnight by `new Date()`,
 * which shifts back a day in US timezones (e.g. displays as Aug 19 instead of Aug 20).
 *
 * This function detects date-only strings and parses them as local time instead.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ""

  // Date-only string (YYYY-MM-DD) — parse as local time to avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString()
  }

  // Full ISO string or other format — parse normally
  return new Date(dateStr).toLocaleDateString()
}
