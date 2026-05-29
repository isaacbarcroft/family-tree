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
 * Build the local-midnight Date for a recurring month/day anniversary in a
 * specific year.
 *
 * `new Date(year, monthIndex, day)` overflows an out-of-range day into the
 * following month — most notably turning Feb 29 into Mar 1 in a non-leap year.
 * That silently shifts leap-day birthdays and anniversaries off their real
 * date. We clamp instead to the last valid day of the intended month
 * (Feb 29 → Feb 28), matching the common convention of observing a Feb 29
 * birthday on Feb 28 in non-leap years.
 */
export function recurringDateInYear(year: number, monthIndex: number, day: number): Date {
  const candidate = new Date(year, monthIndex, day)
  if (candidate.getMonth() === monthIndex) return candidate
  // Overflowed into the following month; day 0 of the next month resolves to
  // the intended month's last day.
  return new Date(year, monthIndex + 1, 0)
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
  let next = recurringDateInYear(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (next.getTime() < today.getTime()) {
    next = recurringDateInYear(today.getFullYear() + 1, birth.getMonth(), birth.getDate())
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
  const age = today.getFullYear() - birth.getFullYear()
  const birthdayThisYear = recurringDateInYear(
    today.getFullYear(),
    birth.getMonth(),
    birth.getDate(),
  )
  if (today.getTime() < birthdayThisYear.getTime()) return age - 1
  return age
}
