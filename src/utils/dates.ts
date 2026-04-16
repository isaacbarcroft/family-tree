/**
 * Parse a date string as local time, avoiding the UTC timezone shift that
 * `new Date("YYYY-MM-DD")` introduces in western timezones.
 */
export function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(dateStr)
}

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
  return parseLocalDate(dateStr).toLocaleDateString()
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Returns the next upcoming occurrence of the given birth date and the number
 * of whole days until it (0 if today is the birthday).
 *
 * Compares midnight-to-midnight so the current time of day does not push
 * today's birthday forward a year.
 */
export function getNextBirthday(birthDate: string): { date: Date; daysUntil: number } {
  const today = startOfToday()
  const birth = parseLocalDate(birthDate)
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (next.getTime() < today.getTime()) {
    next.setFullYear(next.getFullYear() + 1)
  }
  const daysUntil = Math.round((next.getTime() - today.getTime()) / MS_PER_DAY)
  return { date: next, daysUntil }
}

/**
 * Current age in whole years. Returns the age the person has already reached
 * (i.e. for a birthday later this year, returns last year's age).
 */
export function getAge(birthDate: string): number {
  const today = startOfToday()
  const birth = parseLocalDate(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}
