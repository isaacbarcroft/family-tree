---
description: Safety review for any pending RLS migration — do NOT apply to prod
allowed-tools: Read, Grep, Glob, Bash
---

Review all pending RLS-related migrations in `supabase/migrations/` (anything not yet applied to prod, or the most recent one if unclear).

For each migration, verify:

1. **Policy tests exist** — there's a matching Vitest file that covers at minimum:
   - Anonymous user (should be denied)
   - Authenticated user NOT in the allowlist / family (should be denied)
   - Authenticated user IN the allowlist / family (should be allowed per policy intent)
   - Cross-user write attempts (user A trying to update user B's row, should be denied)
2. **Rollback SQL is present** — either as a comment block at the top of the migration file, or as a sibling `*_rollback.sql` file.
3. **Applied to a Supabase branch first** — check git log / migration history for evidence this was tested on a branch, not prod. If unclear, flag it.
4. **Policy predicates are sound** — read the `using` and `with check` clauses:
   - Do they reference the correct auth function (`auth.uid()`)?
   - Do they correctly gate by the allowlist / ownership column?
   - Are there any `using (true)` or `using (auth.role() = 'authenticated')` that would re-open the door?
5. **No data loss risk** — if the migration alters or drops columns used by RLS, confirm backfill is safe.

Report format:

- Green check per item that passed
- Red X per item that failed, with the specific file and line
- Overall verdict: SAFE TO APPLY TO PROD / DO NOT APPLY — fix the flagged items first

Do NOT run `supabase db push` or apply the migration. Review only.
