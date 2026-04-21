# CLAUDE.md — Instructions for Claude Code

This file is loaded automatically by Claude Code at the start of every session. It is the source of truth for how work gets done in this repo.

---

## Project context

**What this is:** A private, family-only legacy web app. Single-family trust boundary — every authenticated user is assumed to be a trusted relative. No public users, no external sharing. See `TODOS.md` for the long-form plan.

**Stack:**
- Next.js 16 (App Router) + React 19 + TypeScript 5 + Turbopack
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Tailwind CSS 4
- D3 (selection + zoom) for the genealogy tree
- Leaflet + react-leaflet for the places map
- Resend for transactional email
- Vitest for tests
- Yarn 1.22 package manager

**Owner:** Isaac Barcroft (CTO/VP Engineering). Treat as a technical peer. Direct, no sugar-coating. Never guess — flag assumptions explicitly.

---

## Source of truth for work

**`TODOS.md` in the repo root is the prioritized backlog.** Structure:

1. **Verification tasks** (do first — audit what's actually implemented)
2. **Critical Bugs (P0)** — fix before any feature work
3. **Phase 1** — highest-value family features
4. **Phase 2** — content depth & archive
5. **Phase 3** — engagement & polish
6. **Phase 4** — AI-assisted features
7. **Technical debt & quality** — ongoing

**Pull work from the top.** Don't jump to Phase 3 while Phase 1 and P0 items remain.

When you finish an item, **update `TODOS.md`**: strike it through (`~~item~~`) or move it to a `## Completed` section at the bottom with the commit SHA.

---

## Code conventions (enforced)

### TypeScript
- **Never use `any`.** If you don't know a type, use `unknown` and narrow, or define the type properly. No exceptions.
- Prefer `type` for object shapes, `interface` only when declaration merging is needed.
- No non-null assertions (`!`) unless there's a comment explaining why the non-null is guaranteed.

### Control flow
- **No `else` blocks.** Use early returns instead. This is non-negotiable.

  ```ts
  // Wrong
  if (user.isAdmin) {
    allowAccess();
  } else {
    denyAccess();
  }

  // Right
  if (user.isAdmin) {
    allowAccess();
    return;
  }
  denyAccess();
  ```

- No `if-else` chains. Split into multiple early-returning `if`s, or use a lookup table/switch.

### Architecture
- MVC-ish separation: keep data access in `src/lib/` or `src/db/`, view logic in `src/components/`, page orchestration in `src/app/*/page.tsx`. Don't mix Supabase calls into JSX.
- Shared types live in `src/models/`. Don't duplicate.

### State
- Codebase is React-hook based (no MobX currently). If MobX is ever introduced, async mutations **must** be wrapped in `runInAction`. Flag this if you see an exception.

### Testing
- Every new utility function gets a Vitest test.
- Every new API route gets a Vitest test with mocked Supabase.
- Every new DB migration (especially RLS changes) gets a test that verifies the policy does what it claims — create a service-role user, an allowed user, and a disallowed user, then assert access.
- Tests are **typed**. No `any` in test files either.

### Commits
- One concern per commit. Don't mix a feature with a refactor.
- Commit message format: `[phase-item] short description` — e.g. `[P0-1] scope RLS policies to app_users allowlist`.

---

## Workflow for picking up a TODO

1. **Read `TODOS.md` top to bottom.** Identify the next unchecked item.
2. **Plan before code.** For anything more than a 1-file change, write a short plan comment in the PR or issue: what files, what schema changes, what tests. Don't start coding a 6-hour feature without a plan.
3. **Ask before assuming.** If the TODO item is ambiguous (e.g. "add reactions" — which emojis? public or per-user-private?), ask Isaac via `AskUserQuestion` before implementing. Never guess on product decisions.
4. **Migrations are one-way in prod.** Before writing a destructive migration (DROP, ALTER with data loss, RLS tightening that could lock people out), **stop and confirm** with Isaac. Include a rollback plan in the migration file as a comment.
5. **Verify, don't just build.** After implementing, actually run the code path: `yarn dev`, click through the UI, run the Vitest suite. Don't mark done on vibes.
6. **Update `TODOS.md`** when done.

---

## Guardrails

### P0-1 (RLS lockdown) — handle with extra care
This is the single most sensitive change in the repo. If you get it wrong, either (a) everyone loses access to their own data, or (b) the vulnerability persists. Specifically:
- Write the migration, then write RLS policy tests **first**, then apply the migration to a Supabase branch (not production).
- Test with at least three auth states: anonymous, authenticated-but-not-in-allowlist, authenticated-and-in-allowlist.
- Have Isaac review the migration SQL before applying to prod.
- Keep a rollback migration ready.

### Destructive operations
- No hard-deletes on `people`, `events`, `memories`, `families`. Use soft-delete (`deletedAt`) — see TODO T-5.
- Before running any `DELETE` or `TRUNCATE` in a migration or script, stop and confirm.

### Secrets
- Supabase service role key stays server-side only. Never import it into a client component.
- Resend API key stays server-side only.
- No secrets in commits. Check `.env.local` is in `.gitignore` before every commit.

### Media / storage
- HEIC conversion is already handled in `src/utils/` — use existing utilities, don't reinvent.
- All uploads go through Supabase Storage with proper bucket policies.
- When adding video/audio, watch the 50MB default upload cap.

### Accessibility
- Every new interactive element needs `aria-label` (if icon-only), keyboard support, and visible focus.
- Every new `<img>` needs `alt`.
- Every new modal needs a focus trap.

---

## Pre-commit checklist

Before committing, verify:

- [ ] `yarn lint` passes
- [ ] `yarn test` passes (or add tests if missing)
- [ ] `yarn build` passes (Turbopack production build)
- [ ] No `any` types introduced
- [ ] No `else` blocks introduced
- [ ] No secrets in the diff
- [ ] `TODOS.md` updated if the item is done
- [ ] Manual smoke test of the affected page in `yarn dev`

---

## Reference links

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Cron Jobs](https://supabase.com/docs/guides/cron)
- [Next.js 16 App Router](https://nextjs.org/docs/app)
- [Resend Batch Send](https://resend.com/docs/api-reference/emails/send-batch-emails)
- [Vitest](https://vitest.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

---

## When in doubt

Read `TODOS.md`. Ask Isaac. Don't guess.
