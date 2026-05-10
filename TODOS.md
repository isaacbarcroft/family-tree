# Family Tree App — Prioritized TODO List

**Review date:** 2026-05-08 (audit #3)
**Previous review:** 2026-05-01
**Reviewer:** Claude
**Audience:** Claude Code (implementation agent)
**Project owner:** Isaac Barcroft (private family use only)

---

## Next up

**Quick wins first — under 1h total:**

1. **T-17** — `/api/webhooks/new-user` auth spot check, ~10 min.
2. **T-13** — wrap `GenealogyTree` in `next/dynamic`, ~30 min. Leaflet is already done in `places/page.tsx`.

**Then in priority order:**

3. **1.6 Accessibility** — start with `TreeNode.tsx` keyboard support. Highest-impact remaining gap; older relatives are the target audience.
4. **T-15** — `middleware.ts` for route-level auth. Defense-in-depth on top of RLS.
5. **1.4** — guided story prompts. Last unshipped Phase 1 engagement feature.
6. **T-3** — extend `next/image` adoption beyond `ProfileAvatar`.

---

## Executive Summary

You've built a lot more than the original plan called for. Current stack is **Next.js 16 + Supabase (Postgres) + Tailwind 4 + D3 + Leaflet + Resend + Vitest** — not the Next.js + Firebase combo the plan proposed. Good call; relational Postgres fits genealogy better than Firestore.

**What's working well:**

- Zero `any` types in the codebase
- Zero `else` blocks in `src/` (one match in an opt-in integration test, outside the convention)
- Zero TODO/FIXME debt markers
- 57 test files in `src/__tests__/`
- RLS lockdown via `app_users` allowlist
- Voice / audio memories with `MediaRecorder`
- Reactions + comments + email digest with token unsubscribe
- "On this day" + birthday reminder digests
- Soft-delete on People / Events / Memories / Families
- Relationship calculator with profile-page chip
- Places map with geocoding
- HEIC conversion pipeline
- GEDCOM import + export with tests
- Full-text search with pg_trgm
- Resend email integration
- Tight auth flow with auto person-creation on signup
- New design-system primitives in `src/components/ui/` (UI refresh PR #28)
- Web Share API for invite links

**What's broken or risky:**

- **GenealogyTree still mouse-only.** The T-12 node-extraction refactor preserved the a11y gap — `TreeNode.tsx` interactive `<g>` elements have no `tabIndex`, `role`, `onKeyDown`, or `aria-label`. Tracked as the highest-impact item in 1.6.
- **No edge-level auth.** `middleware.ts` does not exist; auth is entirely client-side via `AuthProvider`. Tracked as T-15.
- Accessibility is essentially absent outside NavBar (1.6 still pending, ~10–12h)

**What's missing vs. "what would bring most value for a family app":**

- ~~Voice/audio storytelling — shipped 2026-04-27~~
- ~~Reactions/comments on memories — shipped 2026-04-29 → 2026-05-01~~
- ~~"On this day" / birthday reminder emails — shipped 2026-05-06~~
- ~~Relationship calculator — shipped 2026-04-28~~
- ~~Structured oral-history prompts (1.4), shipped 2026-05-10~~
- Document/artifact archive (separate from photo memories) (2.1)
- Health/medical history tracking (2.3)
- Migration map / "where the family lived over time" (2.4)
- Printable family tree poster export (2.6)

---

## Critical Bugs (P0) — all fixed

- ~~**P0-1.** Row-Level Security blanket-open. Fixed 2026-04-23.~~ See Completed log.
- ~~**P0-2.** Single-family trust boundary not documented. Fixed 2026-04-25.~~ See Completed log.
- ~~**P0-3.** Verify stub vs. implemented pages. Closed 2026-04-27.~~ See Completed log.
- ~~**P0-4.** Seed route had no authentication. Fixed 2026-05-04.~~ See Completed log.
- ~~**P0-5.** Convert-image route had no authentication. Fixed 2026-05-05.~~ See Completed log.
- ~~**P0-6.** PostgREST filter injection in `parseIn` / `parseContains`. Fixed 2026-05-02.~~ See Completed log.

**Future P0 follow-ups (deferred):**

- Admin UI to approve/revoke `app_users` members without touching SQL.
- Tighten Supabase auth provider (disable open signups or require invite links) so unapproved accounts can't even be created.
- Per-branch / per-family visibility (~16h follow-up — `visible_to` join table + RLS predicate keyed on a Person → Branch mapping derived from the parent graph).

---

## Phase 1 — Highest-value family features (do these next)

Ordered by value-to-effort. These are what will make family members actually use the app.

### ~~1.1. Voice / audio memories (recording + playback)~~ — Done 2026-04-27

See Completed log. **Open follow-ups:**

- **1.1.a Whisper transcription.** Store transcript in `memories.transcript` for searchability; expose during recording so the user can review/edit before save. +3h. Reference: [Whisper API](https://platform.openai.com/docs/guides/speech-to-text).
- **1.1.b Manual device QA.** Verify on real iOS Safari and Android Chrome before relying on this with relatives. Folded into T-10 mobile QA pass.

### ~~1.2. Reactions and comments on memories~~ — Done 2026-04-29 → 2026-05-05

See Completed log (1.2.a reactions, 1.2.b comments, 1.2.c digest, 1.2.d bulk fetch). **Open follow-ups:**

- **1.2.b.i Surface comments on profile-page memory tiles.** Compact tiles can't hold a textarea — needs a "View comments (N)" link to `/memories?expand=<id>` or a popover. +2h.
- **1.2.b.ii Bulk fetch of comments per page.** `listCommentsForMemories(ids)` already exists; wire it on `/memories` so each tile receives `initialComments` instead of doing N fetches on first paint. +1h.
- **1.2.c.i Self-service preferences UI.** Token-based unsubscribe is the primary opt-out; a `/settings` page that lets a signed-in user flip individual booleans (`reactions`, `comments`) and switch cadence (`daily` / `weekly` / `off`) is a deferred polish item. Requires a self-update RLS policy on `public.app_users` scoped to `notificationPrefs` only (so the same path can't escalate `role`). +2h.
- **1.2.c.ii Real cron wiring.** The route is HTTP-callable and gated by `DIGEST_CRON_SECRET`; the cron schedule itself (Supabase `pg_cron` or Vercel Cron) is documented in `SUPABASE_SETUP.md` but not yet provisioned. +30 min once the deployment target is decided.

### ~~1.3. "On this day" + birthday reminder emails~~ — Done 2026-05-06

See Completed log. **Open follow-ups:**

- **1.3.a Per-family local send time.** The route runs on whatever schedule the deploy target triggers; if you want "7am local" per user or per family branch, you'll need timezone storage plus schedule fan-out. +2h.
- **1.3.b Remembrance birthdays for deceased relatives.** Deceased people are currently excluded from the birthday section entirely. "Would have turned 87 today" remembrance copy is a separate UX decision. +1h.

### [x] 1.4. Guided story prompts ("Ask Grandma" mode) Done 2026-05-10 (PR #53)

**Why:** Blank-textbox syndrome is real. Nobody opens a "Write a memory" form cold. Prompts like _"Tell me about your first car"_ unlock content.
**Scope:**

- Seed 50–100 prompts in a `story_prompts` table with categories (childhood, career, love, faith, travel, holidays, pets)
- Home page widget: "A question for you today: {prompt}" with an "Answer with text" / "Answer with voice" CTA
- When answered, it becomes a memory tagged with the prompt
- Optional: AI-generated follow-up prompts based on their answer (Claude API call)
  **Effort:** 4h prompts + UI, +4h for AI follow-ups
  **Source inspiration:** [StoryWorth](https://welcome.storyworth.com/) (paid competitor; ~$99/yr, does exactly this)

### ~~1.5. Relationship calculator~~ — Done 2026-04-28

See Completed log. **Open follow-ups:**

- **1.5.a In-law relationships** ("Brother-in-law" / "Sister-in-law" / "Mother-in-law" etc.) by chaining a spouse hop on either side. +2h.
- **1.5.b Half-sibling labeling** ("Half-sibling" when only one parent is shared). Currently labeled as "Sibling". +1h.
- **1.5.c Step / adoptive / foster distinctions.** The denormalized `Person.parentIds` field doesn't carry the `relationships.subtype`, so the calculator can't tell them apart without joining against `relationships`. +2h.
- **1.5.d Standalone `/relationships` page** with a two-person picker. The profile-page chip ships first because it's the higher-leverage placement.

### 1.6. Accessibility pass

**Why:** Older relatives will use this. Many use screen readers, large-font modes, or have tremors. Lack of ARIA, focus traps, and alt text is a direct exclusion.

**Highest-impact gap (re-asserted 2026-05-08):**

- **`TreeNode.tsx` interactive `<g>` elements are mouse-only.** The T-12 node-extraction refactor (2026-05-06) preserved the a11y gap from `GenealogyTree.tsx` — the new `src/components/TreeNode.tsx` has zero `tabIndex`, `role="button"`, `onKeyDown`, or `aria-label` on the three interactive groups (single person, couple-left, couple-right). Screen-reader and keyboard-only users cannot interact with the tree at all. Fix: add `role="button" tabIndex={attrs.id ? 0 : -1}` plus an `onKeyDown` handler that routes Enter / Space to `onNavigate`, and an `aria-label` from `node.data.name`. Apply the same pattern to all three branches in `TreeNode.tsx`.

**Remaining scope:**

- `alt` on every `<img>` (especially `ProfileAvatar`)
- Focus trap in every modal (`AddMemoryModal`, `AddEventModal`, `AddFamilyModal`, `AddMemberModal`, `ImportGedcomModal`, `ConfirmDialog`)
- Semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>` on page shells
- `aria-label` on icon-only buttons
- Keyboard navigation on the D3 tree (arrow keys to move between nodes — beyond Enter / Space)
- SVG edges are invisible to screen readers (the `<path>` elements for relationship lines have no `aria-label` or `role`; the tree structure is opaque to assistive technology)
- No focus management after tree node click — the user lands on the profile page with no focus indicator
- Visible `:focus-visible` outline in Tailwind theme
- Run [axe DevTools](https://www.deque.com/axe/devtools/) and fix all critical/serious issues

**Effort:** 10–12h spread across components
**Reference:** [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

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
- Requires tighter RLS — don't build this until the per-branch isolation P0 follow-up lands
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

See Completed log.

### T-2. Component test coverage

Current tests cover utilities (dates, colors, enums, gedcom, geocode, normalize, heic, treeBuilder, sortByIds, webhookNewUser, share, relationship, digest, pgrstEscape, likeEscape, groupReactions, treeLayout, etc.). Missing: page-level integration tests beyond the smoke checks. Add at least:

- `ProfileEditForm` render + submit
- `AddMemoryModal` upload flow (mocked) — partial coverage exists for audio
- `AddEventModal` create flow
- `NavBar` search debounce
- `PlacesMap` pin aggregation
  **Effort:** 10–12h

### T-3. Image optimization (partially done)

`src/components/ProfileAvatar.tsx` already uses `next/image`. Memory thumbnails (`MemoryImage` and the per-tile renders on `/memories` and `/profile/[id]`) are still on plain `<img>` tags. Switch them to `next/image` with explicit `sizes`. Generate thumbnail variants on upload (sharp in an edge function or server action).
**Effort:** 3h
**Reference:** [next/image docs](https://nextjs.org/docs/app/api-reference/components/image)

### ~~T-4. Error boundaries around top-level pages~~ ✅ Done 2026-04-25

See Completed log.

### T-5. Delete/soft-delete policy (partially done — 2026-04-30)

Soft-delete columns + filtered reads shipped. **Open follow-ups:**

- **T-5.a Admin restore UI.** Today, restore is `update <table> set "deletedAt" = null where id = …` via the SQL editor. A `/admin/trash` page that lists deletedAt-not-null rows per table with restore + permanent-purge buttons is the right next step. +3h.
- **T-5.b Hard-purge cron** (Supabase Edge Function or `pg_cron`) that permanently deletes rows with `deletedAt < now() - interval '30 days'`. Should also clean up Supabase Storage objects. +2h. Depends on T-5.a so admins can preempt the purge.
- **T-5.c Storage cleanup on hard-purge.** `deleteMemory` previously did not touch Storage either, so this is not a regression — but it should be addressed when T-5.b lands.
- **T-5.d UI affordance for the destructive action.** Today the delete buttons say "Delete". With soft-delete, "Move to trash" is more accurate. Trivial copy change; bundled with T-5.a.

### T-6. Rate limiting on write endpoints

Geocoding has a rate limit. Nothing else does. If someone leaves a browser tab open and your Resend webhook gets hit, you can burn credits fast. Add [`@upstash/ratelimit`](https://github.com/upstash/ratelimit) or similar on all write API routes.
**Effort:** 3h

### ~~T-7. Align with your code preferences~~ ✅ Done 2026-04-23

See Completed log.

### T-8. Update the project plan doc

Your original plan says Firebase. Your app uses Supabase. Update `docs/` (or wherever the plan lives) so future contributors aren't confused. Also update the stack-choice rationale.
**Effort:** 1h

### ~~T-9. Route naming: `/families` vs `/family/[id]`~~ ✅ Done 2026-04-24

See Completed log.

### T-10. Manual mobile QA pass

**Why:** The code uses responsive Tailwind utilities (`sm:`, `md:`, `lg:`, `min-h-[44px]`) across every content page, but no one has clicked through on a real phone. Older relatives are the target audience; a broken modal or too-small tap target on iOS Safari will silently cost adoption.
**Scope:** Walk through the golden paths on a real iPhone and Android (Chrome + Safari): sign up, add person, upload profile photo, add event, add memory, view family tree (pan/zoom), open timeline, search from NavBar. Log issues and fix them. At minimum, verify: all modals are fully visible and scroll if taller than viewport; NavBar search is reachable; D3 tree is usable via touch. Folds in the 1.1.b microphone QA on iOS Safari + Android Chrome.
**Effort:** 3h QA + whatever fixes surface

### ~~T-11. Genealogy tree performance test at ≥50 people~~ ✅ Done 2026-04-26

See Completed log.

### ~~T-12. GenealogyTree SVG node memoization~~ ✅ Done 2026-05-06

See Completed log. Deferred sub-items (T-12.a real-device frame-rate measurement, T-12.b edge `<path>` memoization) are not worth doing in isolation.

### ~~T-13. Dynamic imports for `GenealogyTree` (Leaflet already done)~~ ✅ Done 2026-05-08

See Completed log. Deferred sub-item (T-13.a real bundle-size measurement via `@next/bundle-analyzer`) tracked but not blocking.

### T-14. Webhook new-user route: duplicate PostgREST filter param

**Found:** 2026-05-01 audit
**File:** `src/app/api/webhooks/new-user/route.ts` lines 54-59
**Problem:** The code appends the `email` query parameter twice — once for `not.is.null` and once for `neq.${newUserEmail}`. PostgREST treats duplicate params as AND so it happens to work correctly, but this is fragile and non-obvious. If PostgREST changes behavior or the params are reordered, it could silently break.
**Fix:** Use a single `and` filter: `params.set("email", "not.is.null")` + `params.append("and", "(email.neq.${newUserEmail})")` or combine into one PostgREST `and()` expression.
**Effort:** 10 min

### T-15. Add Next.js middleware for route protection

**Found:** 2026-05-01 audit. Re-confirmed 2026-05-08: no `middleware.ts` exists at the project root or in `src/`.
**Problem:** Auth is entirely client-side via `AuthProvider`. Unauthenticated users can load any page shell and see loading states / empty layouts before being redirected. While RLS protects data at the database layer, the lack of edge-level auth means: (a) unnecessary Supabase calls from unauthenticated users, (b) flash of loading content before redirect, (c) API routes other than `/api/webhooks/*` and `/api/seed` don't have consistent server-side auth checks.
**Fix:** Add a `middleware.ts` at the project root that checks for a valid session cookie/token and redirects unauthenticated users to `/login` for protected routes. Exclude `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/reset-password`, and `/api/webhooks/*` and `/api/notifications/unsubscribe` (token-based, must work logged-out).
**Effort:** 1h

### ~~T-16. Lint regression — `react-hooks/set-state-in-effect` + unused imports~~ ✅ Done 2026-05-09

See Completed log. All 5 warnings cleared; baseline back to 0/0.

### T-17. Spot-check `/api/webhooks/new-user` for a webhook-secret guard

**Found:** 2026-05-08 audit
**File:** `src/app/api/webhooks/new-user/route.ts`
**Problem:** The route uses `SUPABASE_SERVICE_ROLE_KEY` to write directly to the database in response to a Supabase auth webhook. The 2026-05-01 audit noted the duplicate-param bug (T-14) but did not verify that the route checks an inbound webhook secret. If Supabase's auth-webhook signed-secret check isn't being verified, anyone hitting this URL could trigger person-creation side effects.
**Fix:** Read the route, confirm or add a header check against `process.env.SUPABASE_AUTH_WEBHOOK_SECRET` (or whatever the existing convention is). If a check is already present, close this item with a note. If not, add one and a Vitest case mirroring the `verifyUser.test.ts` shape.
**Effort:** 10 min

---

## Verification tasks (do first) — all done

Before starting Phase 1, Claude Code audited these files and either checked them off or added explicit implementation tasks:

1. [x] `src/app/timeline/page.tsx` — renders a working timeline with type + person filters, events + memories merged, sorted newest-first, with skeleton loading and memory thumbnails. Done 2026-04-23.
2. [x] `src/app/families/page.tsx` and the detail page — list page is functional (paginated, add/delete). Detail page now lives at `src/app/families/[id]/page.tsx` post-T-9. It loads a `Family`, fetches its members, renders `FamilyTreeView`, and exposes invite-link copy + GEDCOM export. Done 2026-04-23.
3. [x] Login / signup flow — `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/auth/callback/page.tsx`, plus `forgot-password` and `reset-password`, are all implemented. Signup accepts `family` (family invite) and `claim` (person claim) query params and hands them to Supabase `signUp` metadata. The callback verifies `token_hash` + `type` via `supabase.auth.verifyOtp` and falls back to implicit-flow hash tokens. Done 2026-04-23.
4. [x] `GenealogyTree` / `FamilyTreeView` — D3 zoom/pan works, couple + single-person node variants render, marriage bar + edge paths, click-to-profile wired. No keyboard navigation (that gap is tracked under 1.6 Accessibility pass). Real-world 50+ person performance has not been measured, so tracked as a new sub-item under T-2 (component tests). Done 2026-04-23.
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

- 2026-05-10: **1.4 Guided story prompts ("Ask Grandma" mode).** Added `20260510_story_prompts.sql` plus rollback to create `public.story_prompts`, seed 50+ prompts across childhood, career, love, faith, travel, holidays, and pets, and add nullable `memories.storyPromptId` with approved-user read access. Added `StoryPrompt` model support in `src/lib/db.ts`, deterministic per-user daily prompt selection in `src/utils/dailyPrompt.ts`, and a new home-page `DailyPromptCard` with text and voice answer entry points. Extended `AddMemoryModal` so prompt answers prefill context, persist `storyPromptId`, and can auto-start recording for voice responses. Added coverage for prompt selection, prompt widget behavior, modal persistence, db fetching, and migration structure. `yarn lint`, `yarn test`, and `yarn build` all passed locally. Follow-up left open: AI-generated follow-up prompts remain out of scope for this task.
- 2026-05-09 — **T-16 Lint regression cleanup — restore 0/0 baseline.** UI refresh (PR #28) re-introduced `react-hooks/set-state-in-effect` warnings in three files plus two unused-import warnings; total 5 warnings, 0 errors. (TODO entry described it as "5 warnings in PhotoFrame.tsx" — actual breakdown was 3 set-state-in-effect across `src/components/ui/PhotoFrame.tsx`, `src/components/ui/Avatar.tsx`, and `src/components/NavBar.tsx`, plus unused `EmptyState` import in `src/app/family-tree/page.tsx` and unused `Icon` import in `src/app/timeline/page.tsx`.) Fixes: (1) `PhotoFrame` and `Avatar` now reset `failed` state via the render-time `prev*` pattern (matching `MemoryImage` / `ProfileAvatar`) instead of `useEffect(() => setFailed(false), [src])`. (2) `NavBar` switched to `useSyncExternalStore<Theme>(subscribeTheme, readTheme, () => "light")` with a module-level `themeListeners` `Set` pub/sub and an `applyTheme()` writer that updates the `<html>` class, persists to `localStorage`, and notifies listeners — replacing the `setTheme(readInitialTheme())` mount effect. The toggle button is gated behind `user`, which is null on SSR, so the `"light"` server snapshot is never user-visible. (3) Dropped the two unused imports. New tests: 2 cases (one each in `src/__tests__/ui/PhotoFrame.test.tsx` and `src/__tests__/ui/Avatar.test.tsx`) pin the regression — after a previous `src` errored, swapping in a new `src` re-renders the `<img>` (failed state must reset across the boundary). 513 tests pass / 5 skipped (was 511/5; added one regression-pin case to each of `PhotoFrame.test.tsx` and `Avatar.test.tsx`); `yarn lint` clean (0/0); `yarn build` green. Files: `src/components/ui/PhotoFrame.tsx`, `src/components/ui/Avatar.tsx`, `src/components/NavBar.tsx`, `src/app/family-tree/page.tsx`, `src/app/timeline/page.tsx`, `src/__tests__/ui/PhotoFrame.test.tsx`, `src/__tests__/ui/Avatar.test.tsx`, `TODOS.md`.
