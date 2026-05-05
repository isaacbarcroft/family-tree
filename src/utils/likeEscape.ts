/**
 * Escape a string so it can be used as a literal inside a PostgREST
 * `like` / `ilike` pattern.
 *
 * SQL `LIKE` treats `%` (any string) and `_` (any single char) as wildcards,
 * and PostgREST additionally translates `*` to `%` for URL-friendliness.
 * Without escaping, user-typed special characters end up as wildcards:
 *
 *   - search for "10%"   → matches anything containing "10"
 *   - search for "_"     → matches every name
 *   - search for "Mary*" → matches "Mary" + anything after
 *
 * We escape `\`, `%`, `_`, and `*` with a leading backslash so PostgREST
 * passes them through as literals (Postgres' default LIKE escape is `\`).
 *
 * Callers still wrap the escaped value with `%` (or PostgREST's `*`) to
 * indicate prefix / contains semantics — only the user-supplied portion
 * goes through this helper.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_*]/g, "\\$&")
}
