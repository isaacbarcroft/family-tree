---
description: Run the pre-commit checklist from CLAUDE.md and report pass/fail
allowed-tools: Bash, Read, Grep
---

Run the pre-commit checklist from `CLAUDE.md`. Do NOT commit — just report each result as PASS / FAIL with evidence.

Checks:

1. **Lint** — `yarn lint`
2. **Tests** — `yarn test --run` (non-watch mode)
3. **Build** — `yarn build`
4. **No `any` introduced** — `git diff --cached` then grep for `: any` and `as any`. Report any hits.
5. **No `else` blocks introduced** — grep the diff for `} else {` and `} else if`. Report any hits.
6. **No secrets in diff** — grep staged diff for: `SUPABASE_SERVICE_ROLE`, `RESEND_API_KEY`, `eyJ` (JWT prefix), `.env.local`. Report any hits.
7. **`TODOS.md` updated** — if a TODO item was just finished, confirm it's been struck through or moved to `## Completed`.
8. **Affected page smoke test** — identify which `src/app/*/page.tsx` changed. Remind me to manually test it in `yarn dev`.

Report format: numbered list, PASS/FAIL per item, one-line explanation. Summary line at the end: "Ready to commit" or "Fix blockers before commit."
