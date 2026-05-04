/**
 * Escape a string so it can be embedded as a literal value inside a
 * double-quoted PostgREST filter — both `in.(...)` and `cs.{...}`.
 *
 * Both filter shapes wrap individual values in `"..."`. Without escaping,
 * a `"` inside the value terminates the literal early and a trailing `\`
 * can swallow the closing quote, either of which alters query semantics
 * or breaks the filter entirely. We escape `\` first (so the second pass
 * doesn't double-encode the escapes we just added) and then `"`.
 *
 * Callers are still responsible for wrapping the returned value in `"`
 * and for emitting the surrounding `(...)` / `{...}`.
 */
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}
