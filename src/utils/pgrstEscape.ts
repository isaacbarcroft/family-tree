/**
 * Escape a string so it can be embedded as a quoted literal inside a
 * PostgREST filter value, e.g. the operands of `in.(...)` or the elements
 * of a `cs.{...}` array literal.
 *
 * PostgREST wraps each value in double quotes; inside those quotes the
 * backslash is the escape character, so a raw `"` or `\` in user input
 * breaks the surrounding filter syntax (and could alter query semantics
 * by closing the quoted token early). We escape `\` -> `\\` and `"` -> `\"`,
 * which mirrors the contract used by `pgInValue` in
 * `src/app/api/geocode/route.ts`.
 *
 * The caller is still responsible for the surrounding quotes and the
 * `(...)` / `{...}` wrapper.
 */
export function escapePgrstString(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}
