# Family Tree App — Prioritized TODO List

**Review date:** 2026-05-01 (audit #2)
**Previous review:** 2026-04-20
**Reviewer:** Claude
**Audience:** Claude Code (implementation agent)
**Project owner:** Isaac Barcroft (private family use only)

---

## Executive Summary

You've built a lot more than the original plan called for. Current stack is **Next.js 16 + Supabase (Postgres) + Tailwind 4 + D3 + Leaflet + Resend + Vitest** — not the Next.js + Firebase combo the plan proposed. Good call; relational Postgres fits genealogy better than Firestore.

**What's working well:**

- Zero `any` types in the codebase
- No TODO/FIXME debt markers
- Places map with geocoding (impressive, beyond MVP)
- HEIC conversion pipeline
- GEDCOM import + export with tests
- Full-text search with pg_trgm
- Resend email integration
- Tight auth flow with auto person-creation on signup

**What's broken or risky:**

- ~~**P0 — RLS is wide open.** Fixed 2026-04-23.~~
- **P0-4 through P0-6 — API route security gaps** found in 2026-05-01 audit. Seed route has no auth, convert-image has no auth, PostgREST filter helpers have an injection vector. See Critical Bugs section.
- Accessibility is essentially absent outside NavBar (1.6 still pending, ~10-12h)

**What's missing vs. "what would bring most value for a family app":**

- ~~Voice/audio storytelling — shipped 2026-04-27~~
- Reactions/comments on memories
- "On this day" / birthday reminder emails (you have Resend wired up — cheap to add)
- Structured oral-history prompts
- Document/artifact archive (separate from photo memories)
- Health/medical history tracking
- Migration map / "where the family lived over time"
- Relationship calculator
- Printable family tree poster export

---

## Critical Bugs (P0 — fix before anyone else logs in)

### P0-1. ~~Row-Level Security is blanket-open~~ Done 2026-04-23

**File:** `supabase/migrations/20260309_initial_schema_and_rls.sql`, `supabase/migrations/20260419_places.sql`
**Problem:** All policies are `using (true)` for authenticated users. Any signup = full read/write/delete on every table.
**Why it mattered:** This is a family-only app. If you invited a cousin and someone else created an account (or a cousin's account was compromised), they saw everything and could delete anything.
**Fix shipped:** `supabase/migrations/20260423_app_users_rls_lockdown.sql` adds a `public.app_users` allowlist, back-fills existing `auth.users` as members, and replaces every `using (true)` policy on `people` / `families` / `events` / `memories` / `residences` / `geocoded_places` / `storage.objects` (media bucket) with allowlist-gated policies. Destructive ops require the row creator or an admin (for `geocoded_places`, which has no `createdBy`, destructive ops are admin-only). Rollback migration and static + opt-in integration tests included. See `SUPABASE_SETUP.md` for the post-apply admin promotion step.
**Follow-ups:**

- Admin UI to approve/revoke members without touching SQL (currently manual via service role or `auth.uid()` admin inserts).
- Tighten the Supabase auth provider (disable open signups or require invite links) so unapproved accounts can't even be created.

### P0-2. ~~No "is this person actually in my family" boundary~~ Done 2026-04-25

**Problem:** Related to above. Even with RLS fixed per-user, if you invite extended family, there's no mechanism for "Aunt Karen shouldn't see my wife's side of the tree." Everyone sees the whole graph.
**Recommendation:** For MVP, punt on this. But **document the assumption** in the README: "This app assumes a single-family trust boundary — every authenticated user sees all data." Revisit when you want to share with in-laws.
**Outcome:** Documented the single-family trust boundary in `README.md` under a new "Trust model and access" section. The section calls out that approved members can read every record, that ownership-only restricts mutations (not reads), and that branch-level isolation requires the ~16h follow-up scope below.
**Follow-up (when needed):** ~16h to add per-branch / per-family visibility (likely a `visible_to` join table + RLS predicate keyed on a Person -> Branch mapping derived from the parent graph).

### ~~P0-3. Verify stub vs. implemented pages~~ Done 2026-04-27

~~**Files to audit:** `src/app/timeline/page.tsx`, `src/app/families/page.tsx`, `src/app/families/[id]/page.tsx`, `src/app/login/*`, `src/app/signup/*` (or whatever your auth pages are)~~
~~**Reason:** The review agent didn't fully read these. Could be working, could be placeholders.~~
~~**Action:** Claude Code should open each, confirm functionality, and mark as "done" or add an explicit "implement" task to this list.~~
**Outcome:** Re-audit on 2026-04-27 confirmed every file in this list is a real, working implementation, not a placeholder. Specifically:

- `src/app/timeline/page.tsx` (204 lines): merges events + memories, sorts newest-first, exposes "all/event/memory" type filter and a person dropdown, renders skeleton loaders, memory thumbnails via `MemoryImage`, and per-item dot indicators colored by `getTimelineItemColor`.
- `src/app/families/page.tsx` (166 lines): paginated grid keyed off `PAGE_SIZE.FAMILIES`, `AddFamilyModal` for creates, creator-gated `ConfirmDialog` for deletes, skeleton loader, and a "Showing X of Y" total counter.
- `src/app/families/[id]/page.tsx` (164 lines, post-T-9 move from `/family/[id]`): fetches the `Family` row plus its member `Person`s, renders `FamilyTreeView`, exposes a clipboard-based invite link (`/signup?family={id}`) and `downloadGedcom` export, and shows a member grid with `ProfileAvatar`.
- `src/app/login/page.tsx` (110 lines): `supabase.auth.signInWithPassword`, email-confirm error path, `?confirmed=1` / `?verify=1` flash messages, auto-redirect to `/` when already signed in, side-by-side `AuthHero` on `md:` and up.
- `src/app/signup/page.tsx` (175 lines): wraps in `Suspense` for `useSearchParams`, forwards `family` and `claim` query params into the Supabase `signUp` user metadata, validates password match, and shows a "Check your email" pending-confirmation card.
  The audit work was already implicitly performed by Verification tasks 1, 2, and 3 (all marked done 2026-04-23); this entry now formally closes the P0-3 gate. No new follow-ups beyond items already tracked (1.6 accessibility, T-9 already done).

### ~~P0-4. Seed route has no authentication~~ Done 2026-05-04

~~**Found:** 2026-05-01 audit~~
~~**File:** `src/app/api/seed/route.ts`~~
~~**Problem:** Both `POST` (create seed data) and `DELETE` (wipe seed data) endpoints use the Supabase service role key to write directly to the database but **never verify the caller is authenticated or authorized**. Anyone who discovers this URL can seed fake data or delete existing records. The route also bypasses RLS entirely since it uses the service role.~~
**Outcome:** Picked option (b) per the recommendation. Added a `notFoundOutsideDev()` guard at the top of both `POST` and `DELETE` in `src/app/api/seed/route.ts` that returns a `NextResponse(null, { status: 404 })` whenever `process.env.NODE_ENV !== "development"`, so the route is unreachable in production, preview, and CI builds. The dev branch is unchanged; behavior on a developer's local machine is identical to before. Belt-and-suspenders UX: `src/app/admin/seed/page.tsx` now early-returns a "Seeding is only available in local development" card in non-dev builds, so the buttons aren't shown wired to a route that would 404. 8 new Vitest cases in `src/__tests__/seedRouteAuth.test.ts` cover: POST/DELETE 404 in production, POST/DELETE 404 in test (the default `NODE_ENV` for vitest), POST/DELETE do not call `fetch` when blocked (verifies the gate runs before any service-role network call), and POST/DELETE pass the gate when `NODE_ENV=development` (asserted via the existing 500 env-vars-missing path so we don't need a full Supabase mock to prove the gate is in the right place). 393 tests pass / 5 skip; lint clean (0 errors / 0 warnings); `yarn build` green.

### ~~P0-5. Convert-image route has no authentication~~ Done 2026-05-05

~~**Found:** 2026-05-01 audit~~
~~**File:** `src/app/api/convert-image/route.ts`~~
~~**Problem:** Accepts arbitrary file uploads for HEIC→JPEG conversion with zero authentication. The `heic-convert` library is CPU-intensive; an attacker who discovers this endpoint could abuse it for free image conversion or resource exhaustion. Every other write endpoint in the app verifies the user — this one was missed.~~
**Outcome:** Extracted the previously inline `verifyUser` from `src/app/api/geocode/route.ts` into a shared helper at `src/lib/verifyUser.ts` so the same auth check now lives in one place. Wired it as the first line of the `POST` handler in `src/app/api/convert-image/route.ts` (returns `401 Unauthorized` before any `formData()` parsing or `heic-convert` work runs). The geocode route now imports the shared helper too — behavior unchanged. Client side, `convertWithServer` in `src/utils/heic.ts` now grabs the current Supabase access token via the existing `getAccessToken()` helper and forwards it as `Authorization: Bearer <jwt>` so the existing HEIC upload UX keeps working. New tests: 8 cases in `src/__tests__/verifyUser.test.ts` (missing env, missing header, malformed scheme, supabase 200, supabase 401, network throw, header forwarding, case-insensitive `bearer`); 8 cases in `src/__tests__/convertImageRoute.test.ts` (missing header / wrong scheme / rejected token / missing env all gate to 401, no `heic-convert` call when blocked, missing-file 400 after auth passes, JPEG passthrough, HEIC conversion path); 1 new case in `src/__tests__/heic.test.ts` pinning that the client sends the bearer token. The route test runs under `// @vitest-environment node` because the jsdom Request/FormData round-trip drops files. 402 tests pass / 5 skipped; lint clean (0 errors / 0 warnings); `yarn build` green. Files: `src/lib/verifyUser.ts` (new), `src/__tests__/verifyUser.test.ts` (new), `src/__tests__/convertImageRoute.test.ts` (new), `src/app/api/convert-image/route.ts`, `src/app/api/geocode/route.ts`, `src/utils/heic.ts`, `src/__tests__/heic.test.ts`.

### ~~P0-6. PostgREST filter injection in `parseIn` / `parseContains`~~ Done 2026-05-02

~~**Found:** 2026-05-01 audit~~
~~**File:** `src/lib/supabase.ts` lines 137-143~~
~~**Problem:** The `parseIn` and `parseContains` helper functions wrap values in double quotes but don't escape internal `"` or `\` characters. If user-controlled data (e.g., a person's name containing a quote) flows through `.in()` or `.contains()`, it breaks the PostgREST filter syntax and could alter query semantics. Compare with `src/app/api/geocode/route.ts:49-51` (`pgInValue`) which correctly escapes `\` → `\\` and `"` → `\"`.~~
**Outcome:** Extracted the `\` → `\\` and `"` → `\"` escape into a shared pure helper `escapePgrstString` in `src/utils/pgrstEscape.ts`. Applied it inside both `parseIn` and `parseContains` in `src/lib/supabase.ts`, so every `.in()` and `.contains()` call now emits a properly quoted PostgREST token regardless of what the user typed. Refactored `pgInValue` in `src/app/api/geocode/route.ts` to consume the shared helper (no behavior change there — it already escaped correctly; this just removes the duplicated regex). 13 new Vitest cases in `src/__tests__/pgrstEscape.test.ts` cover: empty / alphanumerics, backslash escape, double-quote escape, combined-pass ordering pin, that array-syntactic chars (`,`, `(`, `)`, `{`, `}`) pass through untouched, repeated specials, the full `parseIn` / `parseContains` rendered output for plain ids and for inputs containing `"` and `\`, and a `URLSearchParams` round-trip pin so the escapes survive both the URL encode and percent-decode steps. 343 tests pass / 5 skipped; lint clean (0 errors / 0 warnings); `yarn build` green. Files: `src/utils/pgrstEscape.ts` (new), `src/__tests__/pgrstEscape.test.ts` (new), `src/lib/supabase.ts`, `src/app/api/geocode/route.ts`.

---

## Phase 1 — Highest-value family features (do these next)

Ordered by value-to-effort. These are what will make family members actually use the app.

### ~~1.1. Voice / audio memories (recording + playback)~~ Done 2026-04-27

**Why:** This is the single highest-leverage feature for a legacy app. Grandparents who won't type will record. A 3-minute voice note from Grandma about her wedding day is worth more than 50 text memories.
**Outcome:** Migration `20260427_memory_audio.sql` adds nullable `audioUrl` text + `durationSeconds` integer (with non-negative check) columns to `public.memories`; rollback included. RLS is unchanged (the existing `memories` allowlist policies cover the new columns automatically). New `uploadMemoryAudio()` helper in `src/lib/storage.ts` writes under `people/{personId}/memories/audio/{ts}.{ext}` using the existing allowlist-gated `media` bucket; `audioExtensionFor()` maps recorder MIME types (incl. `;codecs=...`) to a canonical extension. `AddMemoryModal` now exposes a Record/Stop/Discard/Re-record flow built on the `MediaRecorder` API: it negotiates a supported codec via `MediaRecorder.isTypeSupported`, shows live elapsed time, releases the microphone stream and revokes preview blob URLs on stop/unmount, and gracefully degrades with an inline error if `getUserMedia` or `MediaRecorder` is unavailable. New `AudioPlayer` component renders an accessible `<audio controls>` with a duration label and is wired into both the expanded memories card and the profile-page memories grid; the unexpanded memory card shows a "voice" indicator. New `formatDuration()` utility shared by the modal and player. Vitest coverage: `duration.test.ts` (4 cases), `storageAudio.test.ts` (path/extension/error, 7 cases), `audioPlayer.test.tsx` (3 cases), `addMemoryModalAudio.test.tsx` (record/submit, discard, missing-MediaRecorder fallback), `memoryAudioMigration.test.ts` (column/check/RLS-untouched/no-destructive, 5 cases). Lint (0 errors), 217 tests passing, `yarn build` green.
**Follow-ups:**

- 1.1.a Whisper transcription. Store transcript in `memories.transcript` for searchability; expose during recording so the user can review/edit before save. Estimated +3h. Out of scope for this PR — flagged as the splittable add-on per the original ticket.
- 1.1.b Manual device QA. The `MediaRecorder` happy path is covered by mocks; verify on real iOS Safari and Android Chrome (microphone permission UI varies by OS) before relying on this with relatives. Add to T-10 mobile QA pass.
  **Reference:** [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [Whisper API](https://platform.openai.com/docs/guides/speech-to-text)

### 1.2. Reactions and comments on memories

**Why:** Turns the app from an archive into a social space. When Grandpa posts a fishing story and five grandkids react, he'll post more.
**Status:** Fully shipped. 1.2.a (reactions) landed 2026-04-29, 1.2.b (comments) landed 2026-05-01, 1.2.c (email digest) landed 2026-05-05, and 1.2.d (bulk reaction fetch) landed 2026-05-01.

- [x] **1.2.a Reactions.** Done 2026-04-29. Migration `20260429_memory_reactions.sql` adds `public.memory_reactions (id, memoryId, userId, emoji, createdAt)` with `unique (memoryId, userId, emoji)`, an emoji `check` constraint locked to `❤️ 😂 🙏 😮`, cascade FKs to `public.memories` and `auth.users`, and per-column lookup indexes. RLS gates SELECT on `is_approved_user()`, INSERT on approved + `userId = auth.uid()`, DELETE on approved + (owner or admin); UPDATE is unreachable (no policy + no `update` grant). New `MemoryReaction` model + `REACTION_EMOJIS`/`REACTION_LABELS` constants. Db helpers (`listReactionsForMemory`, `listReactionsForMemories`, `addReaction`, `removeReaction`) wired in `src/lib/db.ts`. New `MemoryReactions` component (optimistic add/remove with rollback, `aria-pressed` + `aria-label`, disabled-when-signed-out) is shown in the expanded memory card on `/memories` and on every memory tile under each profile page. Coverage: 11 migration assertions, 7 component cases (counts, optimistic add, rollback on failure, optimistic remove, signed-out disable, fetch on mount, no-fetch-when-initial-supplied), 6 db cases (URL filters, in-list build, addReaction body, error propagation, removeReaction tuple). 305 tests pass; lint clean; `yarn build` green.
- [x] **1.2.b Comments.** Done 2026-05-01. Migration `20260501_memory_comments.sql` adds `public.memory_comments (id, memoryId, userId, body, parentCommentId nullable, createdAt, updatedAt)` with cascade FKs to `public.memories` and `auth.users`, a self-cascade FK on `parentCommentId`, a `length(btrim(body)) between 1 and 4000` check, and per-column indexes on `memoryId` / `userId` / `parentCommentId`. Threading is pinned to one level deep by a `before insert or update` trigger that rejects any reply whose parent itself has a non-null `parentCommentId` (errcode `23514`); a second `before update` trigger refreshes `updatedAt` so the UI can show an "(edited)" affordance. RLS uses the existing `is_approved_user()` / `is_admin_user()` helpers: SELECT for any approved user, INSERT for approved + `userId = auth.uid()`, UPDATE for approved + owner only (no admin override on edit, by design — admins delete-and-repost if needed), DELETE for approved + (owner or admin). Rollback migration drops policies, triggers, indexes, helper functions, and the table. New `MemoryComment` model and `listCommentsForMemory` / `listCommentsForMemories` / `addComment` / `updateComment` / `deleteComment` helpers in `src/lib/db.ts`. New `MemoryComments` component renders a chronological thread, fetches author display names by joining `memory_comments.userId` against `people.userId`, supports posting top-level comments, replying one level deep, in-place editing of own comments (with `(edited)` marker when `updatedAt` diverges from `createdAt`), confirm-then-delete on own comments which also strips the row's replies from local state, and shows a "Sign in to comment" nudge to anonymous viewers. Wired into the expanded memory card on `/memories`. Coverage: 14 migration regex assertions (table shape, FK cascades, body-length check, RLS gates incl. update-no-admin, depth + updatedAt triggers, indexes, no-destructive guarantee, rollback contents), 8 db cases (filter + ordering, empty short-circuit, `in` filter build, insert body, reply via parentCommentId, error propagation, update PATCH body, delete tuple), 11 component cases (empty state, count + edited marker, post + append, reply thread, owner edit, no-edit-on-others-comments, confirm-then-delete, post-failure alert, signed-out nudge, mount fetch, no-fetch-when-initial-supplied). 358 tests pass; lint clean; `yarn build` green. `SUPABASE_SETUP.md` lists the new migration.
**Follow-ups (deferred):**
- 1.2.b.i Surface comments on profile-page memory tiles. Currently the per-tile rendering on `/profile/[id]` keeps reactions only — adding the full compose form to a 24×24 thumbnail tile makes the grid unusable. Options: a "View comments (N)" button that links to `/memories?expand=<id>`, or a popover. Estimated +2h.
- 1.2.b.ii Bulk fetch of comments per page (mirrors 1.2.d for reactions): `listCommentsForMemories(ids)` already exists; wire it on `/memories` so each tile receives `initialComments` instead of doing N fetches when the page loads. Estimated +1h.
- [x] **1.2.c Email digest.** Done 2026-05-05. Migration `20260505_notification_prefs.sql` adds three columns to `public.app_users`: `notificationPrefs jsonb not null default '{"digest":"weekly","reactions":true,"comments":true}'::jsonb`, nullable `lastDigestSentAt timestamptz` (so the next run only includes activity after the last successful send; first-run baseline is the user's `createdAt` so brand-new accounts wait one cycle before their first email), and `unsubscribeToken uuid not null default gen_random_uuid()` with a unique index for token-based one-click opt-out. RLS is unchanged — both the digest and unsubscribe routes use the service role and bypass RLS, so the existing admin-only `app_users_admin_update` policy still gates user-facing writes (a `/settings` page is a deferred follow-up). Pure `src/utils/digest.ts` builder groups reactions and comments by memory creator and drops: pre-cycle activity, self-authored activity, activity on memories the recipient does not own, reactions/comments when the matching pref is `false`, and entire recipients when `digest === "off"` or the daily/weekly cadence has not elapsed. New `src/lib/emails/memory-digest.ts` renders the subject (correctly pluralizes and omits zero-count sides) and the HTML body, escaping every interpolated string so memory titles with quotes / angle brackets can't break out of the markup. New `src/app/api/notifications/digest/route.ts` (cron-driven) gates on `x-cron-secret`, reads `app_users` + `memory_reactions` + `memory_comments` + the referenced `memories` rows + each actor's display name from `people` + each recipient's email from the auth admin API, runs the builder, sends via `resend.batch.send` (chunks of 100), then PATCHes `lastDigestSentAt = now()` per recipient that received an email. New `src/app/api/notifications/unsubscribe/route.ts` accepts `?token=<uuid>`, validates the UUID shape locally (so malformed links short-circuit before any DB call), service-role looks up the row, sets `notificationPrefs.digest = "off"` while preserving the other fields, and returns a self-contained HTML page (no auth needed). Tests: 8 migration regex assertions (all three columns + unique index + lastDigestSentAt index + RLS-untouched + no-destructive + pgcrypto), 19 digest-builder cases (prefs normalization including unknown digest values, isDigestDue cadences, reaction/comment grouping with unique actors, self-exclusion, cycle-cutoff, non-owner exclusion, prefs muting, off-skip, ghost-actor fallback, missing-memory drop, multi-recipient), 5 email-template cases (subject pluralization, single-side fallback, generic fallback, HTML escaping of quotes / angle brackets, "Hi there" fallback), 7 digest-route cases (env-vars 500, missing/wrong cron secret 401, no app_users short-circuit, full happy path with batchSend assertion + lastDigestSentAt PATCH stamping, no-activity short-circuit, Resend rejection 500), and 7 unsubscribe-route cases (env-vars 500, missing/malformed token 400, already-unsubscribed 200, success preserves other prefs and writes the right userId, lookup 500, update 500). 478 tests pass; lint clean (0 errors / 0 warnings); `yarn build` green. `SUPABASE_SETUP.md` lists the new migration and documents the cron + env var setup for Supabase Cron / Vercel Cron.

  **Follow-ups (deferred):**
  - 1.2.c.i Self-service preferences UI. The token-based unsubscribe link covers the primary opt-out path (one click from the email). A `/settings` page that lets a signed-in user flip individual booleans (`reactions`, `comments`) and switch cadence (`daily` / `weekly` / `off`) without leaving the app is a deferred polish item. Requires a self-update RLS policy on `public.app_users` scoped to `notificationPrefs` only (so the same path can't escalate `role`). Estimated +2h.
  - 1.2.c.ii Real cron wiring. The route is HTTP-callable and gated by `DIGEST_CRON_SECRET`; the cron schedule itself (Supabase `pg_cron` or Vercel Cron) is documented in `SUPABASE_SETUP.md` but not yet provisioned. Estimated +30min once the deployment target is decided.
- [x] **1.2.d Bulk reaction fetch on list pages.** Done 2026-05-01. `/profile/[id]` now does one `listReactionsForMemories(ids)` round trip alongside the initial `Promise.all` fetch and again whenever `AddMemoryModal.onCreated` fires, then groups via the new pure `groupReactionsByMemoryId(ids, rows)` util in `src/utils/groupReactions.ts` and passes `initialReactions={reactionsByMemoryId.get(m.id) ?? []}` down to every tile. Eliminates the per-tile N+1 — the existing `MemoryReactions` "does not fetch when initialReactions is provided" test pins that the per-memory fetch path no longer fires when bulk-loaded data is supplied. `/memories` is intentionally left as-is: it only renders `MemoryReactions` on the *expanded* tile (one at a time, post-click), so a page-level bulk fetch would pre-load reactions the user may never see. 6 new Vitest cases in `src/__tests__/groupReactions.test.ts` cover empty-ids/empty-rows, seeding every id with `[]`, bucket grouping with relative-order preservation, dropping rows with stale memoryIds, duplicate-id de-duping, and an immutability pin on both inputs.

### ~~1.3. "On this day" + birthday reminder emails~~ Done 2026-05-06 (PR #TBD)

**Why:** Resend was already wired up. This is the cheapest engagement loop in the app, and it compounds with the reaction/comment digest shipped under 1.2.c.
**Outcome:** Extended the existing cron-backed `src/app/api/notifications/digest/route.ts` instead of introducing a second notification pipeline. The route now loads the full family-scale `people`, `memories`, `events`, `memory_reactions`, and `memory_comments` datasets once, then hands them to the pure `src/utils/digest.ts` builder. For each due recipient (`daily` / `weekly` / `off` still comes from `app_users.notificationPrefs.digest`), the builder now adds three sections: activity on memories they created, birthdays for living people whose birthday fell since that recipient's last digest, and "on this day" anniversaries for memories/events whose source date recurred in the window and landed on a 1 / 5 / 10 / 25-year milestone. The email renderer in `src/lib/emails/memory-digest.ts` now produces combined subjects plus separate "Family birthdays", "On this day", and "New activity on your memories" sections, with HTML escaping preserved for every interpolated field. Assumption made explicitly: birthday reminders currently exclude deceased relatives, because those need different remembrance copy from a normal "turns X" birthday note.
**Tests:** Added coverage to the existing digest builder, digest route, and digest email template suites for mixed activity+reminder payloads, birthday/anniversary windowing, milestone filtering, deceased-person exclusion, and subject/body rendering. Also fixed unrelated pre-existing test typing failures in `deletePerson`, `memoryCommentsDb`, `memoryReactionsDb`, and `seedRouteAuth` so `npx tsc --noEmit`, `yarn lint`, and `yarn test` all pass again.
**Follow-ups (deferred):**
- 1.3.a Per-family local send time. The route still runs at whatever schedule the deploy target triggers; if you want "7am local" per user or per family branch, you'll need timezone storage plus schedule fan-out. Estimated +2h.
- 1.3.b Remembrance birthdays for deceased relatives. Right now deceased people are excluded from the birthday section entirely. If you want "would have turned 87 today" remembrance copy, that is a separate UX decision. Estimated +1h.
  **Reference:** [Supabase Cron Jobs](https://supabase.com/docs/guides/cron), [Resend Batch Send](https://resend.com/docs/api-reference/emails/send-batch-emails)

### 1.4. Guided story prompts ("Ask Grandma" mode)

**Why:** Blank-textbox syndrome is real. Nobody opens a "Write a memory" form cold. Prompts like _"Tell me about your first car"_ unlock content.
**Scope:**

- Seed 50–100 prompts in a `story_prompts` table with categories (childhood, career, love, faith, travel, holidays, pets)
- Home page widget: "A question for you today: {prompt}" with an "Answer with text" / "Answer with voice" CTA
- When answered, it becomes a memory tagged with the prompt
- Optional: AI-generated follow-up prompts based on their answer (Claude API call)
  **Effort:** 4h prompts + UI, +4h for AI follow-ups
  **Source inspiration:** [StoryWorth](https://welcome.storyworth.com/) (paid competitor; ~$99/yr, does exactly this)

### ~~1.5. Relationship calculator~~ Done 2026-04-28

**Why:** "How is my daughter related to my great-uncle?" is one of the most-asked questions in any family tree app.
**Outcome:** New `src/utils/relationship.ts` exports `findRelationship(personAId, personBId, peopleById)` that BFSes upward through `Person.parentIds`, finds the lowest common ancestor, and translates the (stepsA, stepsB) pair into a human-readable English label: "Self", "Spouse", "Parent" / "Grandparent" / "Great-grandparent" / "Nx-great-grandparent", "Child"-side mirrors, "Sibling", "Aunt / Uncle" with `Great-` prefixes, "Niece / Nephew" with `Great-` prefixes, and cousins as `{ordinal} cousin {N times} removed`. Result also returns `kind`, `stepsA`, `stepsB`, and `commonAncestorId` for callers that want the structured shape. Profile page now renders a "Your {relationship}" chip in the header card whenever the viewing user has a linked person and is not viewing their own profile; falls through silently when there's no traceable connection. 26 new Vitest cases in `src/__tests__/relationship.test.ts` cover trivial cases (self, spouse, unknown ids, unrelated), direct lines through 6 generations including the `Nx-great-` rollup, collateral relationships at every depth tested (sibling, aunt/uncle through great-great-, niece/nephew through great-), cousins (1st/2nd/3rd; once / twice / thrice / N-times removed), symmetry, malformed parent cycles, and a regression-pin that step-parents are currently treated as biological. All 243 tests + lint + `yarn build` pass.
**Follow-ups (deferred — flagged in the PR description for review):**

- 1.5.a In-law relationships ("Brother-in-law" / "Sister-in-law" / "Mother-in-law" etc.) by chaining a spouse hop on either side. Estimated +2h.
- 1.5.b Half-sibling labeling ("Half-sibling" when only one parent is shared). Currently labeled as "Sibling". Estimated +1h.
- 1.5.c Step / adoptive / foster distinctions. The denormalized `Person.parentIds` field doesn't carry the `relationships.subtype`, so the calculator can't tell them apart without joining against `relationships`. Estimated +2h.
- 1.5.d Standalone `/relationships` page with a two-person picker (the original TODO scope mentioned this; the profile-page chip ships first because it's the higher-leverage placement).
  **Reference:** [Relationship chart logic](https://en.wikipedia.org/wiki/Cousin_chart), [LCA algorithm](https://en.wikipedia.org/wiki/Lowest_common_ancestor)

### 1.6. Accessibility pass

**Why:** Older relatives will use this. Many use screen readers, large-font modes, or have tremors. Lack of ARIA, focus traps, and alt text is a direct exclusion.
**Scope:**

- `alt` on every `<img>` (especially `ProfileAvatar`)
- Focus trap in every modal (`AddMemoryModal`, `AddEventModal`, `AddFamilyModal`, `AddMemberModal`, `ImportGedcomModal`, `ConfirmDialog`)
- Semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>` on page shells
- `aria-label` on icon-only buttons
- Keyboard navigation on the D3 tree (arrow keys to move between nodes)
- Visible `:focus-visible` outline in Tailwind theme
- Run [axe DevTools](https://www.deque.com/axe/devtools/) and fix all critical/serious issues
  **Effort:** 10–12h spread across components
  **Reference:** [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
  **Specific findings from 2026-05-01 audit:**
- ~~**GenealogyTree nodes are mouse-only**~~ Done 2026-05-07 (`src/components/TreeNode.tsx`, `src/components/GenealogyTree.tsx`). Each clickable single-person node and each half of a couple now renders as `role="button"` with `tabIndex={0}` and a descriptive `aria-label` ("View {Name}'s page" plus formatted lifespan when known). An `onKeyDown` handler activates the same `onNavigate` callback as `onClick` on Enter or Space, and Space `preventDefault`s so it doesn't scroll the SVG container. The synthetic family-root label remains inert (no role/tabindex/label) — it's not an action. Edges are now wrapped in an `aria-hidden="true"` group so screen readers don't enumerate every relationship line, and the SVG itself carries `role="group"` + an `aria-label` that tells assistive-tech users how to interact ("Use Tab to move between people; press Enter or Space to open."). Existing global `*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` rule already applies to the now-focusable groups, so the visible focus ring is inherited without theme changes. New tests in `src/__tests__/treeNode.test.tsx`: aria-attributes pin for single-person nodes, Enter and Space activation (with Space `preventDefault` verified via the `fireEvent` boolean return contract), non-activation key ignored (Tab/ArrowRight/letter), root label not focusable, both halves of a couple focusable with distinct labels, Enter on each half routes to the correct id.
- ~~**SVG edges are invisible to screen readers**~~ Resolved 2026-05-07 by the same change — edges are now `aria-hidden="true"` (the structural relationships are conveyed by per-node aria-labels and page layout, not by individual `<path>` elements).
- **No focus management after tree node click**: Clicking a node navigates to the profile page but doesn't manage focus — the user lands on the page with no focus indicator. Still pending; needs a route-level focus-on-mount strategy (e.g. a top-level `<h1 tabindex="-1">` that gets focused after `useRouter().push`). Out of scope for the keyboard-activation PR — call out separately.
- 1.6.a Arrow-key navigation between nodes (move focus from a person to their parent / spouse / next sibling). Today Tab order is whatever DOM order `flattenNodes` emits; that's correct for a baseline but doesn't reflect the visual tree shape. Estimated +3h.

---

## Phase 2 — Content depth & archive features

### 2.1. Document / artifact archive

**Why:** Photos are one kind of heirloom. But scanned letters, birth certificates, military records, marriage licenses, old passports, family bibles — these are the crown jewels of a legacy app, and they don't fit in a "memory."
**Scope:**

- New table `documents (id, title, description, fileUrl, mimeType, documentType enum('certificate','letter','photo','record','bible','other'), personIds[], dateIssued, issuedBy, createdBy)`
- Upload supports PDF, TIFF, PNG, JPG
- Optional: OCR via [Tesseract.js](https://tesseract.projectnaptha.com/) or Google Vision API — store extracted text in a searchable field
- Dedicated `/archive` page with filters by type and person
  **Effort:** 8h without OCR, +4h with

### 2.2. Family recipes collection

**Why:** Every family has "Grandma's pie crust." These are cultural artifacts. A standalone recipes section makes the app feel personal in a way no other genealogy tool does.
**Scope:**

- `recipes (id, name, attributedTo personId, ingredients jsonb, steps text[], photoUrl, tags text[], story text, createdBy)`
- Print-friendly view
- Link recipes to memories ("I learned this from Mom at age 12")
  **Effort:** 4–6h

### 2.3. Family medical history

**Why:** This saves lives. Literally. Knowing that heart disease runs on Dad's side, or that Mom's sister had a specific cancer at 42, is medically actionable data.
**Scope:**

- `medical_history (id, personId, condition, ageOfOnset, notes, isSensitive boolean)`
- "Sensitive" flag restricts visibility to immediate descendants only
- Export a "family medical summary" PDF for doctor visits
- Requires tighter RLS — don't build this until P0-1 is fixed
  **Effort:** 6h

### 2.4. Migration / residence map

**Why:** You already have the Places map. Extend it: draw lines showing where each person lived over time, animated across decades.
**Scope:**

- Use existing `residences` table
- Timeline slider at the bottom of the map
- For each year, show active residences
- Optional: animate transitions between years
  **Effort:** 6–8h (D3 + Leaflet)
  **Reference:** [Leaflet Time Dimension plugin](https://github.com/socib/Leaflet.TimeDimension)

### 2.5. Video memories with transcription

**Why:** Same logic as audio, higher fidelity. A 30-second clip of a toddler is irreplaceable.
**Scope:**

- Accept video uploads in `AddMemoryModal`
- Generate thumbnails client-side
- Supabase Storage has a 50MB default upload cap — either bump it or use [tus-js-client](https://github.com/tus/tus-js-client) for resumable uploads
- Optional: auto-transcribe via Whisper
  **Effort:** 6h

### 2.6. Printable pedigree chart / poster export

**Why:** Grandparents love physical keepsakes. Being able to print a wall-sized family tree PDF is a killer gift-generator feature.
**Scope:**

- Export existing D3 tree as SVG → convert to PDF via [pdf-lib](https://pdf-lib.js.org/) or server-side Puppeteer
- Preset sizes: letter, tabloid, 24×36" poster
- Option for "pedigree only" (direct line) vs. "full descendants"
  **Effort:** 6–8h

---

## Phase 3 — Engagement & polish

### 3.1. Time capsules

Let a user write a message addressed to a specific person (or "future family") with a release date. Stored encrypted-at-rest if you want to be fancy; otherwise just a `releaseDate` field and UI that hides content until then.
**Effort:** 4h

### 3.2. Child milestone tracker

First words, first steps, school photos, height chart over time. Subset of the events feature but with a dedicated UI optimized for "this week" entries.
**Effort:** 6h

### 3.3. Holiday card / address book

Annual holiday card list, exportable to CSV. Contacts pulled from existing Person records with mailing addresses.
**Effort:** 3h

### 3.4. "On this day" home widget

Shows memories and events from the current date in past years. Complements the email (1.3).
**Effort:** 2h

### 3.5. Duplicate detection

When adding a person via GEDCOM or manually, flag likely duplicates (same name + nearby birthdate).
**Effort:** 4h

### 3.6. Audit log / change history

Every create/update/delete on Person, Event, Memory, Family goes into an `audit_log` table. Undo from a settings page. Given this is a legacy app where bad edits could erase Grandma's real birthdate, this is insurance.
**Effort:** 6h

### 3.7. Onboarding tour

First-time users see a guided tour of the app. Use [react-joyride](https://github.com/gilbarbara/react-joyride) or similar.
**Effort:** 4h

### 3.8. Family tree search + jump

Search any name in the full tree visualization, center and highlight. You have the NavBar search — extend it to deep-link into the tree view with highlight state.
**Effort:** 3h

---

## Phase 4 — AI-assisted features

### 4.1. AI-written bios

**Scope:** "Generate a bio from this person's events + memories." Uses Claude API. User reviews/edits before save.
**Effort:** 4h

### 4.2. AI photo colorization / restoration

Old B&W photos → colorized, torn photos → restored. Use [Replicate](https://replicate.com/) models. Store both originals and restored versions.
**Effort:** 6h

### 4.3. AI face detection + auto-tagging

Detect faces in uploaded photos, cluster them, suggest "is this Grandma?" for user confirmation. Use [face-api.js](https://github.com/justadudewhohacks/face-api.js) client-side or a cloud service.
**Effort:** 12h (this one's a real project)

### 4.4. AI relationship inference from GEDCOM

When importing GEDCOM from another relative, detect and suggest merges with existing Person records.
**Effort:** 6h

### 4.5. AI-generated family newsletter

Monthly or quarterly, Claude composes a recap: new memories added, recent birthdays, milestones. User reviews and sends via Resend.
**Effort:** 6h

---

## Technical debt & quality (ongoing)

### ~~T-1. Extract hard-coded constants to config~~ ✅ Done 2026-04-24

~~**Files:** `src/app/family-tree/page.tsx`, `src/app/memories/page.tsx`, `src/app/events/page.tsx`, `src/app/places/page.tsx`, `src/app/api/geocode/route.ts`~~
~~**What:** `PAGE_SIZE`, `MIN_MS_BETWEEN_CALLS`, home-page "recent count" limits, map viewport height.~~
~~**Fix:** Move to `src/config/constants.ts`.~~
**Outcome:** Introduced `src/config/constants.ts` exporting `PAGE_SIZE` (per-list), `HOME_RECENT`, `NOMINATIM_MIN_MS_BETWEEN_CALLS`, and `PLACES_MAP_HEIGHT`. Updated the four list pages (`families`, `memories`, `events`, `family-tree`), the signed-in home page, `places/page.tsx`, `components/PlacesMap.tsx`, and `api/geocode/route.ts` to consume the shared module. Added `src/__tests__/configConstants.test.ts` (5 invariants including the grid-column divisibility rule and the ≥1 req/sec Nominatim policy floor). All 176 tests + build pass; lint warning count unchanged.

### T-2. Component test coverage

Current tests cover utilities (dates, colors, enums, gedcom, geocode, normalize, heic, treeBuilder, sortByIds, webhookNewUser). Missing: component rendering, modal flows, page-level integration. Add at least:

- `ProfileEditForm` render + submit
- `AddMemoryModal` upload flow (mocked)
- `AddEventModal` create flow
- `NavBar` search debounce
- `PlacesMap` pin aggregation
  **Effort:** 10–12h

### T-3. Image optimization

Next.js Image component isn't being used based on the review. Switch profile photos and memory thumbs to `next/image` with explicit `sizes`. Generate thumbnail variants on upload (sharp in an edge function or server action).
**Effort:** 4h
**Reference:** [next/image docs](https://nextjs.org/docs/app/api-reference/components/image)

### ~~T-4. Error boundaries around top-level pages~~ ✅ Done 2026-04-25

~~You have an `ErrorBoundary` component — make sure it wraps every `app/*/page.tsx`. A Firestore… ahem, Supabase… error on the Places page shouldn't white-screen the whole app.~~
**Outcome:** Replaced the layout-level class `ErrorBoundary` with idiomatic Next.js App Router boundaries: `src/app/error.tsx` (per-route segment) and `src/app/global-error.tsx` (root-layout fallback, includes its own `<html><body>`). Both are client components, log the caught error, expose a working `reset()` (Next.js re-renders the segment, fixing the previous bug where "Try Again" only flipped local state and re-threw on the next render), and the route-level boundary adds a "Go Home" link. Error message is shown only in development; in production only the Next-supplied `error.digest` is surfaced as a support reference. The unused `src/components/ErrorBoundary.tsx` was deleted. 8 new Vitest cases (`src/__tests__/errorBoundaries.test.tsx`) cover the alert role, reset behavior, and dev/prod message gating. All 179 tests + lint + `yarn build` pass.

### ~~T-5. Delete/soft-delete policy~~ ✅ Done 2026-04-30 (partial — see follow-ups)

~~Currently deletes are permanent. For a legacy app that's dangerous. Add a `deletedAt` column to Person, Event, Memory, Family. "Delete" marks it. Restore from an admin page. Hard-purge after 30 days via cron.~~
**Outcome:** Migration `20260430_soft_delete.sql` adds a nullable `deletedAt timestamptz` column to `people`, `families`, `events`, and `memories`, plus a partial index `where deletedAt is null` on each so the now-mandatory `deletedAt is null` filter on every list query stays cheap. RLS is unchanged — the existing `*_update_owner_or_admin` policies already cover the soft-delete UPDATE, and the existing `*_delete_owner_or_admin` policies stay in place for the eventual hard-purge cron. Rollback migration included (drops the columns + indexes; data preserved). `src/lib/db.ts`: `deletePerson`, `deleteEvent`, `deleteMemory`, `deleteFamily` now issue `UPDATE … SET "deletedAt" = now()` instead of `DELETE`. `deletePerson` no longer strips bidirectional refs (parent/child/spouse arrays + `families.members`) — they're preserved so a future restore is a single column reset, and dangling refs resolve to "missing" naturally because every read filters them out. Reads patched: `listPeople`, `listEvents`, `listMemories`, `listFamilies` (paginated + non-paginated), `getPersonById`, `listPeopleByIds`, `listMemoriesForPerson`, `listEventsForPerson`, `listFamiliesForPerson`, `autoLinkToFamilyByLastName`, plus all direct `supabase.from(…).select(…)` reads that bypass `lib/db.ts` (NavBar search/own-person-resolve, FamilyTreeView member fetch, AddMemberModal/AddMemoryModal/AddEventModal person search, events/memories/families pages, userPersonLink claim flow). 24 new Vitest cases across `softDeleteMigration.test.ts` (20 — column + partial-index assertions for all 4 tables, no-DROP/no-DELETE in executable SQL, RLS untouched) and `deletePerson.test.ts` (rewritten — 14 cases covering soft-delete PATCH semantics, ref preservation, list filters, `getPersonById` filter, paginated filter). Test mocks for the new `.is()` chain segment updated in `addMemberModalErrorHandling`, `addMemoryModalAudio`, `addMemoryModalBlobUrls`. `SUPABASE_SETUP.md` documents the new migration + the SQL one-liner for restore. `yarn test` 289 pass / 5 skip; lint clean; `yarn build` green.
**Follow-ups (deferred — call out in PR for review):**

- T-5.a Admin restore UI. Today, restore is `update <table> set "deletedAt" = null where id = …` via the SQL editor. A `/admin/trash` page that lists deletedAt-not-null rows per table with restore + permanent-purge buttons is the right next step. Estimated +3h.
- T-5.b Hard-purge cron (Supabase Edge Function or `pg_cron`) that permanently deletes rows with `deletedAt < now() - interval '30 days'`. Should also clean up Supabase Storage objects (memory image / audio / profile photo URLs). Estimated +2h. Depends on T-5.a so admins can preempt the purge.
- T-5.c Storage cleanup on hard-purge. `deleteMemory` previously did not touch Storage either, so this is not a regression — but it should be addressed when T-5.b lands.
- T-5.d UI affordance for the destructive action. Today the delete buttons say "Delete" and pass through `ConfirmDialog`. With soft-delete, "Move to trash" is more accurate and reduces panic when a relative clicks it. Trivial copy change; bundled with T-5.a.

### T-6. Rate limiting on write endpoints

Geocoding has a rate limit. Nothing else does. If someone leaves a browser tab open and your Resend webhook gets hit, you can burn credits fast. Add [`@upstash/ratelimit`](https://github.com/upstash/ratelimit) or similar on all write API routes.
**Effort:** 3h

### ~~T-7. Align with your code preferences~~ ✅ Done 2026-04-23

~~You specified: **no if-else, explicit if statements only; no `any`; MobX async in `runInAction`**. The current code is hook-based (no MobX), has zero `any`, and the if/else convention wasn't audited. Ask Claude Code to grep for `else` and `} else {` and refactor to early-returns.~~
**Outcome:** Eliminated all 20 `else` / `else if` occurrences across `src/app/profile/[id]/page.tsx`, `src/app/login/page.tsx`, `src/app/family/[id]/page.tsx`, `src/app/admin/seed/page.tsx`, `src/components/WelcomeModal.tsx`, `src/components/AddMemberModal.tsx`, `src/components/AddFamilyModal.tsx`, `src/lib/db.ts`, and `src/utils/gedcom.ts`. `grep -rEn "\belse\b" src/` now returns zero hits. Added 3 GEDCOM parser regression tests covering the restructured control flow (NAME without slashes, unrecognized level-1 tags, GIVN/SURN without NAME value). All 150 tests + lint + `yarn build` pass.

### T-8. Update the project plan doc

Your original plan says Firebase. Your app uses Supabase. Update `docs/` (or wherever the plan lives) so future contributors aren't confused. Also update the stack-choice rationale.
**Effort:** 1h

### ~~T-9. Route naming: `/families` vs `/family/[id]`~~ ✅ Done 2026-04-24

~~**Problem:** The list page is at `src/app/families/page.tsx` but the detail page is at `src/app/family/[id]/page.tsx` (singular). REST convention is both plural. Internal links (e.g. `href={`/family/${f.id}`}` in the families list, `/signup?family={id}` invite links that then route users back via the detail page) work, but the inconsistency will bite anyone adding new routes.~~
~~**Fix:** Move `src/app/family/[id]/page.tsx` to `src/app/families/[id]/page.tsx` and update the handful of `Link`/`router.push` references. Keep a redirect (or a small `not-found` -> redirect handler) on the old path for 1 release so stale invite links still land.~~
**Outcome:** Moved the detail page to `src/app/families/[id]/page.tsx` and updated all six internal `Link` call sites (`src/app/page.tsx`, `src/app/families/page.tsx`, `src/app/profile/[id]/page.tsx`, `src/components/FamilyListCompact.tsx`, `src/components/NavBar.tsx`×2). Added a `/family/:id → /families/:id` 307 redirect in `next.config.ts` so stale invite/bookmark links still land (temporary — safe to remove after one release). Added a Vitest regression test (`src/__tests__/nextConfigRedirects.test.ts`). All 151 tests + lint + `yarn build` pass; new route appears as `ƒ /families/[id]` in the build output and the old path is gone.

### ~~T-12. GenealogyTree SVG node memoization~~ Done 2026-05-06

~~**Found:** 2026-05-01 audit~~
~~**File:** `src/components/GenealogyTree.tsx`~~
~~**Problem:** All tree nodes render via `nodes.map()` returning inline SVG groups without `React.memo`. The layout data (`nodes`, `edges`, `bounds`) is properly memoized via `useMemo`, but the JSX output for each node is recreated on every component re-render (e.g., zoom/pan). With 100+ people, this means hundreds of SVG groups + clipPaths + images rebuild unnecessarily.~~
~~**Fix:** Extract node rendering into a `React.memo`-wrapped `TreeNode` component. Also: deduplicate `<clipPath>` definitions — currently each avatar creates its own `<defs><clipPath>` block, but these could be defined once in a shared `<defs>` and reused via ID.~~
**Outcome:** Extracted the per-node SVG render into a new `React.memo`-wrapped `TreeNode` component at `src/components/TreeNode.tsx`. `GenealogyTree`'s `nodes.map(...)` block went from ~150 inline lines (three branches: family-root label, couple, single person) to a one-liner that hands each `LayoutNode` and the stable `navigateToProfile` callback to `<TreeNode />`. Because the memoized `nodes` array, the per-iteration `LayoutNode` references, and the `useCallback`-wrapped `navigateToProfile` are all referentially stable across `treeData`-unchanged re-renders, the inner JSX no longer rebuilds when the parent re-renders for unrelated reasons. Hoisted the three avatar `<clipPath>` definitions (single, couple-left, couple-right) into one shared `<defs>` block at the top of the SVG inside `GenealogyTree`. The default `clipPathUnits="userSpaceOnUse"` resolves each clip in the *referencing* element's local coordinate system, so a single `<clipPath>` per variant covers every node — eliminating two `<defs><clipPath>` blocks per couple and one per single person (concretely: ≈300 fewer SVG nodes on a 200-person tree). Click handlers, deceased styling, name truncation, and the `b. {date}` / `{birth} — {death}` date format are unchanged. 11 new Vitest cases in `src/__tests__/treeNode.test.tsx` cover: family-root label rendering (no rect, no avatar), single-person initials variant, single-person photo variant uses the shared `CLIP_ID_SINGLE`, click navigation on single nodes, deceased-date format, living-date format, couple renders both halves with `CLIP_ID_COUPLE_LEFT` / `CLIP_ID_COUPLE_RIGHT`, regression pin that no per-node `<defs>` / `<clipPath>` blocks are emitted, click routes to the correct half of a couple, the right-side couple clip is positioned to the right of the left-side clip, and the memo `displayName` is preserved. 462 tests pass / 5 skipped; lint clean (0 errors / 0 warnings); `yarn build` green. Files: `src/components/TreeNode.tsx` (new), `src/__tests__/treeNode.test.tsx` (new), `src/components/GenealogyTree.tsx`.
**Follow-ups (deferred):**

- T-12.a Real-device frame-rate measurement on a seeded 100/250-person family. The render-skip is correct in principle but the gain depends on how often the parent actually re-renders today. Worth measuring during the deferred T-11.a benchmark.
- T-12.b Edge `<path>` memoization. The 20-line `edges.map(...)` block in `GenealogyTree` still rebuilds every render. The same `React.memo` treatment would apply but the edge count is small (≤ N-1) and the per-edge JSX is one element, so the gain is minimal — not worth doing in isolation.

### T-13. Dynamic imports for heavy visualization libraries

**Found:** 2026-05-01 audit
**Files:** Components importing D3 (`d3-selection` + `d3-zoom` ~40KB) and Leaflet (`leaflet` ~40KB + `react-leaflet` ~10KB)
**Problem:** Both libraries are statically imported, adding ~120KB to the initial bundle even on pages that don't use them. Neither library works server-side.
**Fix:** Wrap `GenealogyTree` and `PlacesMap` in `next/dynamic(() => import(...), { ssr: false })` at their usage sites. This defers loading until the component is actually rendered.
**Effort:** 30 min

### T-14. Webhook new-user route: duplicate PostgREST filter param

**Found:** 2026-05-01 audit
**File:** `src/app/api/webhooks/new-user/route.ts` lines 54-59
**Problem:** The code appends the `email` query parameter twice — once for `not.is.null` and once for `neq.${newUserEmail}`. PostgREST treats duplicate params as AND so it happens to work correctly, but this is fragile and non-obvious. If PostgREST changes behavior or the params are reordered, it could silently break.
**Fix:** Use a single `and` filter: `params.set("email", `not.is.null`)` + `params.append("and", `(email.neq.${newUserEmail})`)` or combine into one PostgREST `and()` expression.
**Effort:** 10 min

### T-15. Add Next.js middleware for route protection

**Found:** 2026-05-01 audit
**Problem:** Auth is entirely client-side via `AuthProvider`. There is no `middleware.ts` file. Unauthenticated users can load any page shell and see loading states / empty layouts before being redirected. While RLS protects data at the database layer, the lack of edge-level auth means: (a) unnecessary Supabase calls from unauthenticated users, (b) flash of loading content before redirect, (c) API routes other than `/api/webhooks/*` and `/api/seed` don't have consistent server-side auth checks.
**Fix:** Add a `middleware.ts` at the project root that checks for a valid session cookie/token and redirects unauthenticated users to `/login` for protected routes. Exclude `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/reset-password`, and `/api/webhooks/*`.
**Effort:** 1h

### T-10. Manual mobile QA pass

**Why:** The code uses responsive Tailwind utilities (`sm:`, `md:`, `lg:`, `min-h-[44px]`) across every content page, but no one has clicked through on a real phone. Older relatives are the target audience; a broken modal or too-small tap target on iOS Safari will silently cost adoption.
**Scope:** Walk through the golden paths on a real iPhone and Android (Chrome + Safari): sign up, add person, upload profile photo, add event, add memory, view family tree (pan/zoom), open timeline, search from NavBar. Log issues and fix them. At minimum, verify: all modals are fully visible and scroll if taller than viewport; NavBar search is reachable; D3 tree is usable via touch.
**Effort:** 3h QA + whatever fixes surface

### ~~T-11. Genealogy tree performance test at ≥50 people~~ ✅ Done 2026-04-26

~~**Why:** Verification step 4 confirmed the tree renders correctly, but did not measure it on a realistic dataset. `layoutTree` runs in the render path (not memoized) and D3 re-initializes the zoom behavior on every `treeData`/`dims` change. Needs a smoke test at 50, 100, and 250 people before shipping to the full family.~~
~~**Scope:** Seed a large family via `admin/seed` (or add a larger seed), measure first-paint and interaction latency, memoize `layoutTree` with `useMemo` if frame time exceeds ~16ms.~~
**Outcome:** Pure layout functions extracted to `src/utils/treeLayout.ts` (`layoutTree`, `flattenNodes`, `collectEdges`, `computeBounds`, `edgePath`). `layoutTree` now memoizes subtree widths, dropping the inner `positionNode → computeWidth` recursion from O(n²) to O(n). `GenealogyTree` memoizes `layout`/`nodes`/`edges`/`bounds` with `useMemo`, so they no longer recompute on unrelated parent re-renders. The zoom `useEffect` was split: the zoom behavior is now created exactly once on mount (with cleanup), and the initial fit-to-view runs once per `treeData` identity instead of every render — which had been silently resetting the user's pan/zoom. A small "Reset view" button preserves the centering affordance. `ResizeObserver` keeps `dims` accurate across viewport resizes. 11 new Vitest cases in `src/__tests__/treeLayout.test.ts` cover layout positioning, sibling spacing, edge wiring, bounds, and a 250-node perf guard. Deferred (call out for follow-up): real-device timing benchmark with a seeded 50/100/250-person family in `admin/seed` — the perf guard test asserts the algorithm scales, but a manual measurement on the actual page is still worth doing once a large dataset exists.

---

## Verification tasks (do first)

Before starting Phase 1, Claude Code should audit these files and either check them off or add explicit implementation tasks:

1. [x] `src/app/timeline/page.tsx` — renders a working timeline with type + person filters, events + memories merged, sorted newest-first, with skeleton loading and memory thumbnails. Done 2026-04-23.
2. [x] `src/app/families/page.tsx` and the detail page — list page is functional (paginated, add/delete). Detail page lives at `src/app/family/[id]/page.tsx` (singular, not plural as this TODO list implied). It loads a `Family`, fetches its members, renders `FamilyTreeView`, and exposes invite-link copy + GEDCOM export. Follow-up: the plural/singular route mismatch is surfaced as T-9. Done 2026-04-23.
3. [x] Login / signup flow — `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/auth/callback/page.tsx`, plus `forgot-password` and `reset-password`, are all implemented. Signup accepts `family` (family invite) and `claim` (person claim) query params and hands them to Supabase `signUp` metadata. The callback verifies `token_hash` + `type` via `supabase.auth.verifyOtp` and falls back to implicit-flow hash tokens. Done 2026-04-23.
4. [x] `GenealogyTree` / `FamilyTreeView` — D3 zoom/pan works, couple + single-person node variants render, marriage bar + edge paths, click-to-profile wired. No keyboard navigation (that gap is already tracked under 1.6 Accessibility pass). Real-world 50+ person performance has not been measured, so tracked as a new sub-item under T-2 (component tests). Done 2026-04-23.
5. [x] Mobile responsiveness — `sm:`, `md:`, and `lg:` utilities are present across profile, memories, events, timeline, families, and family-tree pages, with `min-h-[44px]` touch targets on primary buttons. Visual QA on real devices not performed; tracked as T-10. Done 2026-04-23.
6. [x] `README.md` + `SUPABASE_SETUP.md` — both exist. README was out of date (claimed Next.js 15, `react-d3-tree`, a `contexts/` folder that does not exist, omitted Vitest/Resend/Leaflet, referenced only the initial migration). `SUPABASE_SETUP.md` only listed the initial migration and not the two newer ones. Both files updated in this PR. Done 2026-04-23.

---

## Suggestion: also run this through GPT-4.1

This TODO list is long-form, strategy-heavy, and opinionated. **Worth comparing against GPT-4.1's take** — different model, different instincts, especially on feature prioritization. Your preferences flagged this pattern. My bias is toward engagement features (voice, reactions, prompts) because research on legacy apps shows most content creation happens in the first 30 days and then drops off a cliff; I'm optimizing for sustained usage. A different model might weight differently.

---

## Sources

- [MediaRecorder API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [Supabase Cron Jobs](https://supabase.com/docs/guides/cron)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Resend Batch Send](https://resend.com/docs/api-reference/emails/send-batch-emails)
- [StoryWorth (competitor reference)](https://welcome.storyworth.com/)
- [Leaflet Time Dimension](https://github.com/socib/Leaflet.TimeDimension)
- [pdf-lib](https://pdf-lib.js.org/)
- [Tesseract.js (OCR)](https://tesseract.projectnaptha.com/)
- [face-api.js](https://github.com/justadudewhohacks/face-api.js)
- [axe DevTools (a11y)](https://www.deque.com/axe/devtools/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [next/image](https://nextjs.org/docs/app/api-reference/components/image)
- [Upstash Ratelimit](https://github.com/upstash/ratelimit)
- [react-joyride](https://github.com/gilbarbara/react-joyride)

---

## Completed

- 2026-05-06 — **T-12 GenealogyTree node memoization + shared clip-path defs.** Pulled the per-node SVG render out of `src/components/GenealogyTree.tsx` (~150 inline lines, three branches: family-root label / couple / single person) and into a new `React.memo`-wrapped `TreeNode` component at `src/components/TreeNode.tsx`. The memoized `nodes` array, the per-iteration `LayoutNode` references, and the existing `useCallback`-wrapped `navigateToProfile` are all referentially stable across `treeData`-unchanged re-renders, so the inner JSX no longer rebuilds when the parent re-renders for unrelated reasons (today: dims/zoomBehavior state churn). Hoisted the three avatar `<clipPath>` definitions (single, couple-left, couple-right) into one shared `<defs>` block at the top of the SVG. The default `clipPathUnits="userSpaceOnUse"` resolves each clip in the *referencing* element's local coordinate system, so a single `<clipPath>` per variant covers every node — eliminating two `<defs><clipPath>` blocks per couple and one per single person (≈300 fewer SVG nodes on a 200-person tree). Click handlers, deceased styling, name truncation, and the `b. {date}` / `{birth} — {death}` date format are unchanged. Coverage: 11 new Vitest cases (`src/__tests__/treeNode.test.tsx`) cover family-root label rendering, single-person initials and photo variants (including shared `CLIP_ID_SINGLE` reference), single-node click navigation, deceased and living date formats, couple rendering with both halves and the couple-specific clip-paths, a regression pin that no per-node `<defs>` / `<clipPath>` blocks are emitted, click routing on each half of a couple, the shared right-side clip is positioned to the right of the left-side clip, and the memo `displayName` is preserved. 462 tests pass / 5 skipped; lint clean (0 errors / 0 warnings); `yarn build` green. Files: `src/components/TreeNode.tsx` (new), `src/__tests__/treeNode.test.tsx` (new), `src/components/GenealogyTree.tsx`. Deferred (T-12.a real-device frame-rate measurement on a seeded 100/250-person family — depends on T-11.a; T-12.b edge `<path>` memoization — minimal payoff, not worth doing in isolation).
- 2026-05-04 — **P0-4 Seed route locked to local development.** Both `POST` and `DELETE` on `/api/seed` previously used the Supabase service role key to write directly to the database with zero auth check, so any caller who knew the URL could seed fake rows or wipe the seed dataset (and, because the route uses the service role, RLS would not stop them). Picked the recommended option (b) from the TODO and gated both verbs behind `process.env.NODE_ENV === "development"` via a small `notFoundOutsideDev()` helper that returns `NextResponse(null, { status: 404 })` whenever `NODE_ENV` is anything other than `"development"`. Added a matching UX guard to `src/app/admin/seed/page.tsx` that early-returns a "Seeding is only available in local development" card in non-dev builds, so the buttons aren't visible while pointed at a route that will now 404. Coverage: 8 new Vitest cases (`src/__tests__/seedRouteAuth.test.ts`) — POST/DELETE 404 in production, POST/DELETE 404 in test (default vitest env), POST/DELETE never call `fetch` when blocked (proves the gate runs before any service-role network call), and POST/DELETE pass the gate when `NODE_ENV=development` (asserted via the existing 500 env-vars-missing path so the test doesn't need a full Supabase mock). 393 tests pass / 5 skip; lint clean; `yarn build` green. Files: `src/app/api/seed/route.ts`, `src/app/admin/seed/page.tsx`, `src/__tests__/seedRouteAuth.test.ts` (new), `TODOS.md`.
- 2026-05-02 — **P0-6 PostgREST filter injection in `parseIn` / `parseContains`.** The custom QueryBuilder's `.in()` and `.contains()` helpers in `src/lib/supabase.ts` wrapped each value in double quotes but never escaped internal `"` or `\`, so a user-typed name containing a quote (e.g. `Mary "Mae" Smith`) would close the quoted token mid-value and the rest of the string would be parsed as additional filter operands. Today every callsite happens to pass UUIDs, so no live exploit, but the sharp edge made the API unsafe to extend to user-typed values (places, names, search terms). Fix: extracted `\` → `\\` and `"` → `\"` into a pure shared helper `escapePgrstString` in `src/utils/pgrstEscape.ts` and routed both QueryBuilder helpers + the geocode route's `pgInValue` (previously inline-duplicated) through it. 13 new Vitest cases pin the escape contract, the `parseIn`/`parseContains` rendered output for inputs containing `"` and `\`, that PostgREST array-syntactic chars (`,`, `(`, `)`, `{`, `}`) pass through untouched, and a `URLSearchParams` round-trip so the escapes survive both URL-encode and percent-decode. 343 pass / 5 skip; lint clean; `yarn build` green. Files: `src/utils/pgrstEscape.ts` (new), `src/__tests__/pgrstEscape.test.ts` (new), `src/lib/supabase.ts`, `src/app/api/geocode/route.ts`.
- 2026-05-01 — **1.2.b Memory comments (threaded, one level deep).** Migration `20260501_memory_comments.sql` (+ rollback) adds `public.memory_comments (id, memoryId, userId, body, parentCommentId nullable, createdAt, updatedAt)` with cascade FKs on `memories(id)`, `auth.users(id)`, and self on `memory_comments(id)`; body length is constrained `between 1 and 4000` (after `btrim`); indexes on `memoryId`, `userId`, `parentCommentId`. A `before insert or update` trigger pins replies to one level deep (rejects with errcode `23514`); a `before update` trigger refreshes `updatedAt`. RLS gates SELECT on `is_approved_user()`, INSERT on approved + `userId = auth.uid()`, UPDATE on approved + owner only (no admin override on edit), DELETE on approved + (owner or admin). New `MemoryComment` model. New `listCommentsForMemory`, `listCommentsForMemories`, `addComment` (top-level + threaded replies), `updateComment`, `deleteComment` in `src/lib/db.ts`. New `MemoryComments.tsx` component renders the thread, fetches author display names via `people.userId` lookup, supports post / reply / in-place edit (with "(edited)" marker driven by `updatedAt > createdAt`) / confirm-then-delete (also drops the row's replies from local state), and shows a "Sign in to comment" nudge when signed out. Wired into the expanded memory card on `/memories`. Coverage: 14 migration cases (`memoryCommentsMigration.test.ts`), 8 db cases (`memoryCommentsDb.test.ts`), 11 component cases (`memoryComments.test.tsx`). 358 tests pass; lint clean; `yarn build` green. `SUPABASE_SETUP.md` lists the new migration. Deferred (call out in PR for review): 1.2.b.i surface comments on profile-page memory tiles (compact tiles can't hold a textarea — needs a "View (N)" link or popover); 1.2.b.ii bulk-fetch comments per page on `/memories` so each tile receives `initialComments` instead of doing N round-trips on first paint.
- 2026-05-01 — **1.2.d Bulk reaction fetch on profile page.** `/profile/[id]` now bulk-fetches all reactions for the page's memories in one PostgREST `in.()` round trip (alongside the existing `Promise.all`), groups them by memoryId via the new pure `groupReactionsByMemoryId(ids, rows)` util in `src/utils/groupReactions.ts`, and passes the slice down as `initialReactions` to every `<MemoryReactions />` tile — replacing the previous N per-tile `eq.` fetches with a single `in.` fetch. The same path runs again from `AddMemoryModal.onCreated` so a freshly-added memory still gets a real (empty) reactions bucket without a per-tile spinner. `/memories` is intentionally left unchanged: it renders `MemoryReactions` only on the *expanded* tile (one at a time, post-click), so a page-level bulk fetch would preload reactions the user may never see and the per-tile fetch is already amortized across user intent. The pre-existing component test "does not fetch when initialReactions is provided" pins that supplying the bulk data prevents the per-tile fetch entirely. 6 new Vitest cases in `src/__tests__/groupReactions.test.ts` (empty-ids, empty-rows seed, bucket grouping with relative-order preservation, drop stale memoryIds, duplicate-id de-dup, input immutability pin). 336 tests pass / 5 skip; lint clean; `yarn build` green. Files: `src/app/profile/[id]/page.tsx`, `src/utils/groupReactions.ts` (new), `src/__tests__/groupReactions.test.ts` (new), `TODOS.md`.
- 2026-05-01 — **Bug: escape user-typed wildcards in `ilike` searches.** The custom Supabase QueryBuilder's `ilike()` passed user input straight into the LIKE pattern, so a user typing `%`, `_`, `*`, or `\` in any search box hit Postgres / PostgREST wildcards instead of literal characters. Concrete failures: searching for `_` matched every name, `100%` matched anything containing `100`, `Mary*` matched everything starting with `Mary`. Fix: new `src/utils/likeEscape.ts` exports `escapeLikePattern(s)` that prefixes each `\`, `%`, `_`, and `*` with a backslash (Postgres' default LIKE escape). Applied at all 9 call sites: `NavBar` global search (people + families), `AddMemoryModal` person tag, `AddEventModal` person tag, `AddMemberModal` person search, `AddFamilyModal` family search, `db.ts` `autoLinkToFamilyByLastName` (case-insensitive last-name match), `userPersonLink.tsx` claim-by-firstName/lastName lookup. Coverage: 10 new cases in `src/__tests__/likeEscape.test.ts` (empty / alphanumeric / each special char / mixed / repeated / contract pin for already-escaped input / URL-encoding round-trip through `URLSearchParams`). Bookend `%` wildcards added by callers stay live so contains/starts-with semantics are preserved — only the user-supplied substring is escaped. All 269 tests + lint + `yarn build` pass.
- 2026-04-30 — **T-5 soft-delete (partial — admin restore UI + cron hard-purge deferred).** Migration `20260430_soft_delete.sql` adds `deletedAt timestamptz` to `people`, `families`, `events`, `memories` (rollback included), plus partial `where deletedAt is null` indexes per table. `deletePerson` / `deleteEvent` / `deleteMemory` / `deleteFamily` now issue `UPDATE … SET "deletedAt" = now()` rather than `DELETE`. Bidirectional ref strip is removed from `deletePerson` so restore is a one-column reset; dangling refs are tolerated by `treeBuilder` and the list-by-id helpers because every read filters `deletedAt is null`. Filter applied across `lib/db.ts` (paginated + non-paginated `listPeople`/`listEvents`/`listMemories`/`listFamilies`, `getPersonById`, `listPeopleByIds`, `listMemoriesForPerson`, `listEventsForPerson`, `listFamiliesForPerson`, `autoLinkToFamilyByLastName`) and every direct `supabase.from(…).select(…)` outside `lib/db.ts` (NavBar search + own-person resolve, FamilyTreeView, AddMemberModal/AddMemoryModal/AddEventModal person search, events/memories/families pages, userPersonLink claim flow). RLS is unchanged. 24 new Vitest cases (`softDeleteMigration.test.ts` + rewritten `deletePerson.test.ts`); component test mocks for the new `.is()` chain segment updated in `addMemberModalErrorHandling`, `addMemoryModalAudio`, `addMemoryModalBlobUrls`. `SUPABASE_SETUP.md` documents the migration + the SQL one-liner restore. 289 tests pass, 5 skipped; lint clean; `yarn build` green. Deferred (T-5.a admin trash UI, T-5.b hard-purge cron, T-5.c Storage cleanup on purge, T-5.d "Move to trash" copy) tracked under T-5 entry.
- 2026-04-29 — **1.2.a Memory reactions.** New `public.memory_reactions` table (migration `20260429_memory_reactions.sql` + rollback) with `unique (memoryId, userId, emoji)`, emoji `check` locked to `❤️ 😂 🙏 😮`, cascade FKs to `public.memories` and `auth.users`, per-column indexes. RLS uses the existing `is_approved_user()` / `is_admin_user()` helpers: SELECT for any approved user, INSERT for approved + `userId = auth.uid()`, DELETE for approved + (owner or admin); UPDATE is intentionally not granted (immutable rows). New `MemoryReaction` model and `REACTION_EMOJIS` / `REACTION_LABELS` constant module. `src/lib/db.ts` gains `listReactionsForMemory`, `listReactionsForMemories`, `addReaction`, `removeReaction`. New `MemoryReactions.tsx` component does optimistic add/remove with rollback-on-failure, full `aria-pressed` + `aria-label` (count + "you reacted" affordance), and disables itself when the viewer isn't signed in. Wired into the expanded memory card on `/memories` and into the per-tile rendering on the profile-page memories grid. Coverage: 11 migration regex assertions (table shape, FK cascades, unique constraint, RLS gates, no-destructive guarantee, indexes, rollback contents), 7 component cases (zero-state render, count aggregation + pressed state, optimistic add, rollback + alert on failure, optimistic remove, signed-out disable, fetch-on-mount, no-fetch-when-initial-supplied), 6 db cases (URL filters, empty short-circuit, `in` filter build, insert body, error propagation, full delete tuple). 305 tests pass; lint clean; `yarn build` green. Splits 1.2 into three remaining sub-tasks (1.2.b comments, 1.2.c email digest, 1.2.d bulk reaction fetch) — see entry under Phase 1.

- 2026-04-29 — **Lint cleanup: eliminate React 19 `set-state-in-effect` + `exhaustive-deps` warnings.** ESLint with the React 19 ruleset was flagging 11 warnings across 9 files (9 × `react-hooks/set-state-in-effect`, 2 × `react-hooks/exhaustive-deps`). All 11 fixed; lint baseline is now 0 errors / 0 warnings. Patterns applied: (1) **render-time `prev*` tracking** for "reset state when prop changes" — `ProfileAvatar` (error reset on `src` swap), `ResidencesEditor` (form reset when row prop swaps), `AddMemberModal` (clear results when search empties), `NavBar` (search clear, person-id reset on user logout, menu close on pathname change). All four mirror the existing `MemoryImage` pattern. (2) **`useSyncExternalStore`** for read-once-from-browser-API-on-mount — `WelcomeModal` (localStorage seen flag with SSR-safe `getServerSnapshot`), `reset-password/page.tsx` (URL hash via `hashchange` subscription). (3) **`useSearchParams`** + `Suspense` boundary — `login/page.tsx`, replacing the manual `window.location.search` parse. (4) **`useCallback`** for fetch functions referenced from effects — `events/page.tsx`, `memories/page.tsx`. Reset-password page also extracted a pure `parseRecoveryHash` function (now exported) so the validation logic is unit-testable in isolation. New tests: `profileAvatar.test.tsx` (4 cases incl. error-reset-on-src-change regression pin), `welcomeModal.test.tsx` (4 cases for localStorage gating + dismissal), `parseRecoveryHash.test.ts` (8 cases for empty / bad-type / missing-token / valid / malformed-jwt / no-leading-`#`). 259 tests passing total (243 → 259), `yarn lint` clean, `yarn build` green. Files: `src/components/ProfileAvatar.tsx`, `src/components/ResidencesEditor.tsx`, `src/components/AddMemberModal.tsx`, `src/components/NavBar.tsx`, `src/components/WelcomeModal.tsx`, `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/events/page.tsx`, `src/app/memories/page.tsx`, plus 3 new test files.
- 2026-04-28 — **1.5 Relationship calculator.** New `src/utils/relationship.ts` exports `findRelationship(personAId, personBId, peopleById): RelationshipResult | null`. BFSes upward through `Person.parentIds`, finds the lowest common ancestor, and translates (stepsA, stepsB) into a human-readable English label: "Self", "Spouse", "Parent" / "Grandparent" / "Great-grandparent" / "Nx-great-grandparent", mirrored child labels, "Sibling", "Aunt / Uncle" with `Great-` prefixes, "Niece / Nephew" with `Great-` prefixes, and cousins as `{ordinal} cousin {N times} removed`. Result also returns `kind`, `stepsA`, `stepsB`, and `commonAncestorId`. Profile page renders a "Your {relationship}" chip in the header card whenever the viewing user has a linked person and isn't viewing their own profile. 26 new Vitest cases in `src/__tests__/relationship.test.ts` (243 tests total, lint clean, `yarn build` green). Deferred: in-laws (1.5.a), half-sibling labels (1.5.b), step/adoptive distinction (1.5.c), standalone `/relationships` page (1.5.d).
- 2026-04-27 — **P0-3 audit close-out.** Re-audited all five pages in P0-3's "Files to audit" list (`timeline`, `families`, `families/[id]`, `login`, `signup`). Each is a complete, non-stub implementation; full per-file behavior summary recorded inline under the (now struck-through) P0-3 entry. The actual audit work had already been done by Verification tasks 1-3 on 2026-04-23; this entry formally closes the critical-bug gate so Phase 1 can be picked up cleanly. No new follow-ups beyond already-tracked items (1.6 accessibility, T-10 mobile QA). No code changes; TODOS.md only.
- 2026-05-01 — **Codebase audit #2 (security, performance, a11y, code quality).** Full audit found 3 new P0 security issues (P0-4 seed route no auth, P0-5 convert-image no auth, P0-6 PostgREST filter injection), 4 new tech debt items (T-12 SVG memoization, T-13 dynamic imports, T-14 webhook duplicate filter, T-15 middleware), and specific accessibility gaps in GenealogyTree (added to 1.6). Clean bill on conventions: zero `any`, zero `else` blocks, no `dangerouslySetInnerHTML`, no leaked secrets, `.env` properly gitignored, error boundaries in place.
- 2026-04-28 — **UX: reframe person pages around remembrance.** Driven by user feedback ("I feel sortof weird making a profile for my dead parents"). Dropped "profile" as a user-facing noun across 7 files — replaced with the person's name on page titles, "Edit details" / "Edit my details" on action buttons, "My page" in the nav dropdown, and softened the Biography / Family / Family-Groups empty states. For deceased people (gated on `person.deathDate`), the page now leads with remembrance: primary CTA is "Share a memory of {firstName}" (wired to the existing `AddMemoryModal` `preTaggedPersonId` prop), the "Edit details" button is secondary, the empty Biography reads "What do you remember about {firstName}?" with a primary "Share a memory" button + quiet "Or edit details" link, and the Memories empty state reads "Be the first to share a memory of {firstName}." Living-person pages get the copy pass only — functional UX unchanged. The existing memorial banner ("In loving memory of …") was kept as-is. No schema changes; the `/profile/[id]` route stays for bookmark stability. Files: `src/app/profile/[id]/page.tsx`, `src/components/NavBar.tsx`, `src/components/WelcomeModal.tsx`, `src/app/page.tsx`, `src/app/signup/page.tsx`, `src/components/AddMemberModal.tsx`, `src/app/places/page.tsx`. Lint clean (0 errors), 217 tests passing, `yarn build` green.
- 2026-04-27 — **1.1 Voice / audio memories (recording + playback).** Migration `20260427_memory_audio.sql` adds nullable `audioUrl` + `durationSeconds` to `public.memories` (rollback included; RLS unchanged). `AddMemoryModal` gains a `MediaRecorder`-based record/stop/discard/re-record flow with live elapsed time, codec negotiation (`isTypeSupported`), graceful fallback when the browser lacks `MediaRecorder`/`getUserMedia`, and full cleanup of streams + blob URLs on unmount. New `uploadMemoryAudio()` (with `audioExtensionFor()` MIME→ext mapping) writes audio to `people/{personId}/memories/audio/{ts}.{ext}` under the existing allowlist-gated `media` bucket. New shared `formatDuration()` utility and `AudioPlayer` component drop-in to the expanded memories list and profile memories grid; the collapsed memory card surfaces a "voice" indicator. Coverage: 19 new Vitest cases across 5 files; all 217 tests pass; lint clean; `yarn build` green. Whisper transcription explicitly deferred as 1.1.a; real-device microphone QA folded into T-10.
- 2026-04-27 — **P0-3 verify stub vs. implemented pages.** Closed as duplicate; the audit was completed under the Verification tasks (items 1-3) and the only gap surfaced (route naming) was already shipped as T-9 on 2026-04-24.
- 2026-04-23 — Verification tasks (all six sub-items). README + SUPABASE_SETUP.md refreshed. Follow-ups filed as T-9, T-10, T-11.
- 2026-04-23 — **P0-1 RLS lockdown.** Added `public.app_users` allowlist + `is_approved_user` / `is_admin_user` SECURITY DEFINER helpers, replaced every blanket `using (true)` policy on data tables and the media bucket, gated destructive ops on creator-or-admin. Back-fill seeds existing `auth.users` to avoid lockout; admin promotion is a manual follow-up (see `SUPABASE_SETUP.md`). Rollback migration included. Static migration-structure test + opt-in Vitest integration test (`RUN_RLS_INTEGRATION=1`).
- 2026-04-23 — **T-7 no-else refactor.** 20 `else` / `else if` occurrences eliminated across 9 files; added 3 regression tests for the GEDCOM parser control-flow changes. Codebase now fully conforms to the CLAUDE.md "no `else` blocks" rule.
- 2026-04-24 — **T-9 route naming alignment.** `/family/[id]` moved to `/families/[id]`; six internal `Link` call sites updated; legacy path gets a 307 redirect in `next.config.ts`; regression test added.
- 2026-04-26 — **T-11 genealogy tree perf + pan/zoom fix.** Pure layout functions extracted to `src/utils/treeLayout.ts`; `layoutTree` memoizes subtree widths (O(n²) → O(n)); `GenealogyTree` memoizes layout output and splits zoom-setup from initial-fit so user pan/zoom isn't reset on parent re-renders; `ResizeObserver` for dims; "Reset view" button preserves centering; 11 new Vitest cases (`treeLayout.test.ts`). Deferred: live measurement on a seeded 50/100/250-person family.
- 2026-04-25 — **P0-2 trust boundary documentation.** Added a "Trust model and access" section to `README.md` that states the single-family assumption, explains the `app_users` allowlist gate, and notes that ownership rules cover mutations but not reads. Branch-level isolation remains a future ~16h scope.
- 2026-04-25 — **T-4 error boundaries.** Replaced layout-level class `ErrorBoundary` with idiomatic `src/app/error.tsx` (per-route) + `src/app/global-error.tsx` (root). `reset()` now actually re-renders the segment instead of just flipping local state. Dev shows full message; prod shows only `error.digest` as a support reference. Old component deleted; 8 new Vitest cases added.
- 2026-04-24 — **T-1 extract hard-coded constants.** New `src/config/constants.ts` centralizes `PAGE_SIZE` per list, `HOME_RECENT.*` counts, `NOMINATIM_MIN_MS_BETWEEN_CALLS`, and `PLACES_MAP_HEIGHT`. Eight files updated to consume it; `configConstants.test.ts` adds 5 invariants. All 176 tests + build pass.
