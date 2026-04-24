# Family Tree App — Prioritized TODO List

**Review date:** 2026-04-20
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
- **P0 — RLS is wide open.** Any authenticated user can CRUD any record. For a truly private family app, this is a design flaw, not just a compliance issue. See Critical Bugs section.
- Accessibility is essentially absent outside NavBar
- Some pages (timeline, families/[id], login/signup) weren't verified in the review — flagged below

**What's missing vs. "what would bring most value for a family app":**
- Voice/audio storytelling (huge value for older relatives — more on this below)
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

### ~~P0-1. Row-Level Security is blanket-open~~
**File:** `supabase/migrations/20260309_initial_schema_and_rls.sql`, `supabase/migrations/20260419_places.sql`
**Problem:** All policies are `using (true)` for authenticated users. Any signup = full read/write/delete on every table.
**Why it matters:** This is a family-only app. If you invite a cousin and someone else creates an account (or a cousin's account is compromised), they see everything and can delete anything.
**Fix:**
- Add an `invite_code` / `family_group_id` concept, OR a simple allowlist table `app_users (user_id, role)` where `role in ('admin','member')`.
- Rewrite RLS policies to gate on membership in that allowlist: `using (auth.uid() in (select user_id from app_users))`.
- Restrict destructive mutations (`delete`, `update`) to `createdBy = auth.uid()` or `role = 'admin'`.
- Add RLS policy tests (pgTAP or just Vitest + a service-role-created user).
**Effort:** 3–4h
**Done 2026-04-24.** New migration `20260424_rls_lockdown.sql` introduces `public.app_users` (`userId`, `role`, `invitedBy`, `createdAt`), `is_app_user()` / `is_app_admin()` SECURITY DEFINER helpers, and rewrites every policy on `people` / `families` / `events` / `memories` / `residences` / `geocoded_places` plus the `media` bucket writes. UPDATE / DELETE on owner-bearing tables additionally require `createdBy = auth.uid()::text` or `is_app_admin()`. Existing `auth.users` are backfilled as admins so nobody is locked out. New signups are NOT auto-allowlisted (intentional). Tests: `supabase/tests/rls_policies.test.sql` covers anon / outsider / member / admin scenarios; `src/__tests__/rlsLockdownMigration.test.ts` locks in the migration structure. Rollback SQL is embedded as a comment block in the migration.
**Follow-ups:**
- Admin UI to view / add / remove / promote `app_users` entries (currently SQL-only).
- Invite-code flow that auto-adds a new signup to `app_users` when a valid code is presented.

### P0-2. No "is this person actually in my family" boundary
**Problem:** Related to above. Even with RLS fixed per-user, if you invite extended family, there's no mechanism for "Aunt Karen shouldn't see my wife's side of the tree." Everyone sees the whole graph.
**Recommendation:** For MVP, punt on this. But **document the assumption** in the README: "This app assumes a single-family trust boundary — every authenticated user sees all data." Revisit when you want to share with in-laws.
**Effort:** 0h now, ~16h when you need it

### P0-3. Verify stub vs. implemented pages
**Files to audit:** `src/app/timeline/page.tsx`, `src/app/families/page.tsx`, `src/app/families/[id]/page.tsx`, `src/app/login/*`, `src/app/signup/*` (or whatever your auth pages are)
**Reason:** The review agent didn't fully read these. Could be working, could be placeholders.
**Action:** Claude Code should open each, confirm functionality, and mark as "done" or add an explicit "implement" task to this list.
**Effort:** 30min audit

---

## Phase 1 — Highest-value family features (do these next)

Ordered by value-to-effort. These are what will make family members actually use the app.

### 1.1. Voice / audio memories
**Why:** This is the single highest-leverage feature for a legacy app. Grandparents who won't type will record. A 3-minute voice note from Grandma about her wedding day is worth more than 50 text memories.
**Scope:**
- Add `audioUrl` and `durationSeconds` fields to `memories` table
- Mic recording UI in `AddMemoryModal` (use `MediaRecorder` API — no library needed)
- Upload to Supabase Storage under `media/audio/{userId}/{uuid}.webm`
- Playback component (simple `<audio controls>` is fine)
- Optional: transcription via OpenAI Whisper API in a Next.js API route. Store transcript in `memories.transcript` for searchability.
**Effort:** 6–8h without transcription, +3h with
**Reference:** [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [Whisper API](https://platform.openai.com/docs/guides/speech-to-text)

### 1.2. Reactions and comments on memories
**Why:** Turns the app from an archive into a social space. When Grandpa posts a fishing story and five grandkids react, he'll post more.
**Scope:**
- New table `memory_reactions (id, memoryId, userId, emoji, createdAt)` — unique on (memoryId, userId, emoji)
- New table `memory_comments (id, memoryId, userId, body, createdAt, parentCommentId nullable)`
- Grid of emoji reactions under each memory card (❤️ 😂 🙏 😮)
- Threaded comments (one level deep is plenty)
- Email digest when someone reacts/comments on your post (reuse Resend)
**Effort:** 6–8h

### 1.3. "On this day" + birthday reminder emails
**Why:** Resend is already wired up. This is the cheapest engagement loop you can build. Weekly email = weekly return visits.
**Scope:**
- Supabase Edge Function (cron, daily at 7am local) that:
  - Finds birthdays today → emails the family
  - Finds memories/events from exactly 1, 5, 10, 25 years ago → includes in email
  - Sends via Resend batch API
- Unsubscribe preference per user (`users.notification_prefs jsonb`)
- Weekly "family digest" summary
**Effort:** 4–6h
**Reference:** [Supabase Cron Jobs](https://supabase.com/docs/guides/cron), [Resend Batch Send](https://resend.com/docs/api-reference/emails/send-batch-emails)

### 1.4. Guided story prompts ("Ask Grandma" mode)
**Why:** Blank-textbox syndrome is real. Nobody opens a "Write a memory" form cold. Prompts like *"Tell me about your first car"* unlock content.
**Scope:**
- Seed 50–100 prompts in a `story_prompts` table with categories (childhood, career, love, faith, travel, holidays, pets)
- Home page widget: "A question for you today: {prompt}" with an "Answer with text" / "Answer with voice" CTA
- When answered, it becomes a memory tagged with the prompt
- Optional: AI-generated follow-up prompts based on their answer (Claude API call)
**Effort:** 4h prompts + UI, +4h for AI follow-ups
**Source inspiration:** [StoryWorth](https://welcome.storyworth.com/) (paid competitor; ~$99/yr, does exactly this)

### 1.5. Relationship calculator
**Why:** "How is my daughter related to my great-uncle?" is one of the most-asked questions in any family tree app.
**Scope:**
- BFS on the parent-child graph from two selected people, finding their lowest common ancestor (LCA)
- Translate path into English: "second cousin once removed", "great-great-aunt", etc.
- Put it on the profile page and as a standalone "Relationship finder" page
- Unit tests for tricky cases (step-siblings, half-siblings, adopted, in-laws)
**Effort:** 6h
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

### T-1. Extract hard-coded constants to config
**Files:** `src/app/family-tree/page.tsx`, `src/app/memories/page.tsx`, `src/app/events/page.tsx`, `src/app/places/page.tsx`, `src/app/api/geocode/route.ts`
**What:** `PAGE_SIZE`, `MIN_MS_BETWEEN_CALLS`, home-page "recent count" limits, map viewport height.
**Fix:** Move to `src/config/constants.ts`.
**Effort:** 1h

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

### T-4. Error boundaries around top-level pages
You have an `ErrorBoundary` component — make sure it wraps every `app/*/page.tsx`. A Firestore… ahem, Supabase… error on the Places page shouldn't white-screen the whole app.
**Effort:** 2h

### T-5. Delete/soft-delete policy
Currently deletes are permanent. For a legacy app that's dangerous. Add a `deletedAt` column to Person, Event, Memory, Family. "Delete" marks it. Restore from an admin page. Hard-purge after 30 days via cron.
**Effort:** 4h

### T-6. Rate limiting on write endpoints
Geocoding has a rate limit. Nothing else does. If someone leaves a browser tab open and your Resend webhook gets hit, you can burn credits fast. Add [`@upstash/ratelimit`](https://github.com/upstash/ratelimit) or similar on all write API routes.
**Effort:** 3h

### T-7. Align with your code preferences
You specified: **no if-else, explicit if statements only; no `any`; MobX async in `runInAction`**. The current code is hook-based (no MobX), has zero `any`, and the if/else convention wasn't audited. Ask Claude Code to grep for `else` and `} else {` and refactor to early-returns.
**Effort:** 2h

### T-8. Update the project plan doc
Your original plan says Firebase. Your app uses Supabase. Update `docs/` (or wherever the plan lives) so future contributors aren't confused. Also update the stack-choice rationale.
**Effort:** 1h

### T-9. Route naming: `/families` vs `/family/[id]`
**Problem:** The list page is at `src/app/families/page.tsx` but the detail page is at `src/app/family/[id]/page.tsx` (singular). REST convention is both plural. Internal links (e.g. `href={`/family/${f.id}`}` in the families list, `/signup?family={id}` invite links that then route users back via the detail page) work, but the inconsistency will bite anyone adding new routes.
**Fix:** Move `src/app/family/[id]/page.tsx` to `src/app/families/[id]/page.tsx` and update the handful of `Link`/`router.push` references. Keep a redirect (or a small `not-found` -> redirect handler) on the old path for 1 release so stale invite links still land.
**Effort:** 1h

### T-10. Manual mobile QA pass
**Why:** The code uses responsive Tailwind utilities (`sm:`, `md:`, `lg:`, `min-h-[44px]`) across every content page, but no one has clicked through on a real phone. Older relatives are the target audience; a broken modal or too-small tap target on iOS Safari will silently cost adoption.
**Scope:** Walk through the golden paths on a real iPhone and Android (Chrome + Safari): sign up, add person, upload profile photo, add event, add memory, view family tree (pan/zoom), open timeline, search from NavBar. Log issues and fix them. At minimum, verify: all modals are fully visible and scroll if taller than viewport; NavBar search is reachable; D3 tree is usable via touch.
**Effort:** 3h QA + whatever fixes surface

### T-11. Genealogy tree performance test at ≥50 people
**Why:** Verification step 4 confirmed the tree renders correctly, but did not measure it on a realistic dataset. `layoutTree` runs in the render path (not memoized) and D3 re-initializes the zoom behavior on every `treeData`/`dims` change. Needs a smoke test at 50, 100, and 250 people before shipping to the full family.
**Scope:** Seed a large family via `admin/seed` (or add a larger seed), measure first-paint and interaction latency, memoize `layoutTree` with `useMemo` if frame time exceeds ~16ms.
**Effort:** 2h

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

- 2026-04-23 — Verification tasks (all six sub-items). README + SUPABASE_SETUP.md refreshed. Follow-ups filed as T-9, T-10, T-11.
- 2026-04-24 — P0-1 RLS lockdown. Migration `20260424_rls_lockdown.sql` + `app_users` allowlist + `is_app_user()` / `is_app_admin()` helpers + scoped policies. SQL scenario test at `supabase/tests/rls_policies.test.sql`; structural Vitest guard at `src/__tests__/rlsLockdownMigration.test.ts`.
