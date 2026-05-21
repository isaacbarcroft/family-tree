# Family Tree App — Prioritized TODO List

**Review date:** 2026-05-08 (audit #3)
**Previous review:** 2026-05-01
**Reviewer:** Claude
**Audience:** Claude Code (implementation agent)
**Project owner:** Isaac Barcroft (private family use only)

---

## Next up

**In priority order (refreshed 2026-05-21):**

1. **1.6.c Focus management after tree node click.** After `router.push(/profile/[id])`, move focus to the new page's main heading so keyboard users do not start back at the top of the page.
2. **1.6.b Per-section `<section>` / `<article>` landmarks inside page bodies.** Page shells already get `<main>` and `<nav>` via layout; this is the inner-content landmark pass.
3. **1.6.d Run [axe DevTools](https://www.deque.com/axe/devtools/)** and fix all critical / serious issues. Best done after 1.6.b to 1.6.c so the tree and landmark changes are reflected in the report.
4. **T-15** — `middleware.ts` for route-level auth. Defense-in-depth on top of RLS.
5. **1.4** — guided story prompts. Last unshipped Phase 1 engagement feature.
6. **T-3** — extend `next/image` adoption beyond `ProfileAvatar`.

Done 2026-05-21 (this PR): **1.6.a Arrow-key navigation on the D3 tree.**

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

- ~~**GenealogyTree still mouse-only.**~~ Resolved 2026-05-10. `TreeNode.tsx` interactive groups now ship with `role="button"`, `tabIndex`, `aria-label`, `onKeyDown` (Enter/Space), and an SVG-aware focus-visible stroke. See 1.6.
- **No edge-level auth.** `middleware.ts` does not exist; auth is entirely client-side via `AuthProvider`. Tracked as T-15.
- Accessibility is essentially absent outside NavBar (1.6 still pending, ~10–12h)

**What's missing vs. "what would bring most value for a family app":**

- ~~Voice/audio storytelling — shipped 2026-04-27~~
- ~~Reactions/comments on memories — shipped 2026-04-29 → 2026-05-01~~
- ~~"On this day" / birthday reminder emails — shipped 2026-05-06~~
- ~~Relationship calculator — shipped 2026-04-28~~
- Structured oral-history prompts (1.4)
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

### 1.4. Guided story prompts ("Ask Grandma" mode)

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

- ~~**`TreeNode.tsx` interactive `<g>` elements are mouse-only.**~~ Done 2026-05-10 on `claude/vigilant-cannon-hbeef`. All three interactive groups (single person, couple-left, couple-right) now carry `role="button"`, `tabIndex={0}` when a person id exists (`-1` otherwise), an `aria-label` derived from the person's name (and birth/death dates for single-person nodes), and an `onKeyDown` handler that routes `Enter` and `Space` to `onNavigate` (with `preventDefault` on `Space` so the page does not scroll). Visual focus is painted via a stroke-change rule in `globals.css` (`.tree-node-interactive:focus-visible > rect, .tree-node-interactive:focus-visible > circle`), since browsers render `outline` on SVG groups inconsistently. Coverage: 9 new Vitest cases in `src/__tests__/treeNode.test.tsx`.

**Audited 2026-05-18 — these items in the original "Remaining scope" list were already in place and are now marked done:**

- ~~`alt` on every `<img>`~~ Verified 2026-05-18. Every direct `<img>` rendered from the codebase routes through `ProfileAvatar` (alt prop forwarded), `MemoryImage` (alt prop forwarded), `ui/Avatar` (alt = name + the wrapper's `aria-label={name}`), or `ui/PhotoFrame` (alt prop with empty-string default for decorative use, plus a `photo-placeholder` fallback). The only inline `<img>` is the upload thumbnail preview in `AddMemoryModal.tsx:359` with `alt=""`, which is decoration during the form's draft state.
- ~~Focus trap in every modal~~ Verified 2026-05-18. `src/components/Modal.tsx` already implements the trap: initial focus on first focusable child, `Tab` and `Shift+Tab` cycling, `Escape` close, scroll lock on `body`, and focus restore to the previously focused element on unmount. All five real modals (`AddMemoryModal`, `AddEventModal`, `AddFamilyModal`, `AddMemberModal`, `ImportGedcomModal`, `WelcomeModal`) render through `Modal`. `ConfirmDialog` is not actually a modal, it is an inline confirm/cancel button pair, so the focus-trap requirement does not apply.
- ~~Semantic HTML landmarks (`<main>`, `<nav>`) on page shells~~ Verified 2026-05-18. `src/app/layout.tsx` wraps `{children}` in `<main>` so every route gets the landmark for free, and `src/components/NavBar.tsx:197` renders the navigation as `<nav>`. Per-section `<section>` / `<article>` markup inside page bodies is the remaining sub-piece (tracked below as 1.6.b).
- ~~`aria-label` on icon-only buttons~~ Verified 2026-05-18 via a full sweep of `<button>` elements under `src/components` and `src/app`. Every icon-only button already carries an `aria-label`: NavBar account menu / theme toggle / mobile menu, the family-tree page delete buttons (grid + list), the families page delete button, and the GEDCOM import modal close button.
- ~~Visible `:focus-visible` outline in Tailwind theme~~ Verified 2026-05-18. `src/app/globals.css:135` already declares `*:focus-visible { outline: 2px solid var(--sage-deep); outline-offset: 2px; border-radius: 4px }`, and the tree-node case has its own SVG-aware override at `globals.css:225` (stroke change on the group's primary visible child).
- ~~SVG edges + tree structure invisible to screen readers~~ Done 2026-05-18 (this branch). `src/components/GenealogyTree.tsx` now labels the inner `<g>` wrapping the tree content with `role="group"` plus an `aria-label` that names the visualization and explains the Tab / Enter / Space interaction. The shared `<defs>` block and every decorative edge `<path>` are marked `aria-hidden="true"` so assistive tech only surfaces the focusable person nodes (which keep their existing `role="button"` + per-person `aria-label` from `TreeNode.tsx`). Coverage: 4 new Vitest cases in `src/__tests__/genealogyTreeA11y.test.tsx` (labelled group with usage hint, defs hidden, every edge path hidden, focusable buttons still nested inside the labelled group).

**Remaining scope:**

- ~~**1.6.a Keyboard navigation on the D3 tree (arrow keys to move between nodes, beyond Enter / Space).**~~ Done 2026-05-21. The outer `<g>` in `GenealogyTree.tsx` is now `role="tree"` (was `role="group"`); every focusable person `<g>` in `TreeNode.tsx` is `role="treeitem"` (was `role="button"`) with `aria-level` / `aria-setsize` / `aria-posinset`. Roving tabindex: the tree owns a `focusedId` state, and at any time exactly one treeitem has `tabindex={0}` while the rest carry `tabindex={-1}`. New pure `src/utils/treeNavigation.ts` (`buildTreeNavigation` + `resolveArrowTarget`) computes `up` / `down` / `left` / `right` neighbors per id; couples expose both halves as adjacent treeitems with ArrowLeft / ArrowRight stepping between the partner and the sibling boundary appropriately. ArrowUp / ArrowDown move between generations (parent ↔ first child). Home / End jump to the first / last focusable id in DFS order. Enter / Space still activate. Focus is moved programmatically via a ref map after each navigation key. All six keys (ArrowUp / ArrowDown / ArrowLeft / ArrowRight / Home / End) call `preventDefault` so the page does not scroll. Coverage: 14 new cases in `src/__tests__/treeNavigation.test.ts` for the pure nav util (lone root, couples, synthetic-root collapse, posInSet / setSize, Home / End resolution, unknown-id null), 7 new cases in `src/__tests__/treeNode.test.tsx` (treeitem role, ARIA level / setsize / posinset, arrow-key + Home / End dispatch, arrow-key preventDefault, registerRef mount + unmount, roving-tabindex `-1` for unfocused), and 5 new cases in `src/__tests__/genealogyTreeA11y.test.tsx` (`role="tree"` with usage hint mentioning arrow keys, exactly-one-tabindex-0 roving invariant, ArrowDown moves to child, ArrowUp returns to parent, ArrowRight / ArrowLeft step between couple halves, Home / End jumps). Existing tests updated for the role rename. 562 tests pass / 5 skipped (was 535/5; +27 across new + replaced cases); `yarn lint` clean (0 / 0); `yarn build` green. Files: `src/utils/treeNavigation.ts` (new), `src/components/TreeNode.tsx`, `src/components/GenealogyTree.tsx`, `src/__tests__/treeNavigation.test.ts` (new), `src/__tests__/treeNode.test.tsx`, `src/__tests__/genealogyTreeA11y.test.tsx`, `TODOS.md`.
- **1.6.b Per-section `<section>` / `<article>` landmarks inside page bodies.** Page shells get `<main>` and `<nav>` via layout already; this is the inner-page-content landmark pass.
- **1.6.c Focus management after tree node click.** After `router.push(/profile/[id])` lands, the new page should move focus to the main heading so keyboard users do not start back at the top of the page.
- **1.6.d Run [axe DevTools](https://www.deque.com/axe/devtools/) and fix all critical / serious issues.**

**Effort:** 4 to 6h spread across components for the remaining sub-items (1.6.a is most of it).
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

### ~~T-14. Webhook new-user route: duplicate PostgREST filter param~~ ✅ Done 2026-05-19

Replaced the two duplicate `email=…` query params with a single PostgREST
`and()` filter (`and=(email.not.is.null,email.neq."<email>")`) and routed the
new user's email through `escapePgrstString` so a `,`, `)`, or `"` in the
value can't break the surrounding filter syntax. Added two regression tests
in `src/__tests__/webhookNewUser.test.ts` — one asserts the new filter shape
and that no `email` keys remain on the query string; the other feeds in an
RFC 5321 quoted-local-part email (`weird"name@example.com`) and checks the
embedded quote is escaped.

### T-15. Add Next.js middleware for route protection

**Found:** 2026-05-01 audit. Re-confirmed 2026-05-08: no `middleware.ts` exists at the project root or in `src/`.
**Problem:** Auth is entirely client-side via `AuthProvider`. Unauthenticated users can load any page shell and see loading states / empty layouts before being redirected. While RLS protects data at the database layer, the lack of edge-level auth means: (a) unnecessary Supabase calls from unauthenticated users, (b) flash of loading content before redirect, (c) API routes other than `/api/webhooks/*` and `/api/seed` don't have consistent server-side auth checks.
**Fix:** Add a `middleware.ts` at the project root that checks for a valid session cookie/token and redirects unauthenticated users to `/login` for protected routes. Exclude `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/reset-password`, and `/api/webhooks/*` and `/api/notifications/unsubscribe` (token-based, must work logged-out).
**Effort:** 1h

### ~~T-16. Lint regression — `react-hooks/set-state-in-effect` + unused imports~~ ✅ Done 2026-05-09

See Completed log. All 5 warnings cleared; baseline back to 0/0.

### ~~T-17. Spot-check `/api/webhooks/new-user` for a webhook-secret guard~~ ✅ Done 2026-05-10

See Completed log.

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

- 2026-05-18 — **Styling drift — port `MemoryComments` and `MemoryReactions` to the paper design system.** Audit-driven, not a tracked TODO. PR #28 redesigned the surrounding `/memories` and `/profile/[id]` page shells onto the paper tokens (`var(--paper)` / `var(--ink)` / `var(--hairline)` / `var(--sage-deep)` / `var(--clay-deep)`) but missed the two embedded engagement components, so reaction pills and the comments thread continued to render with the legacy dark theme (`bg-gray-700/800/900`, `text-gray-100/200/300/400`, `text-white`, `border-gray-700`, `text-red-400`) — dark cards visibly punched holes in the redesigned light pages. Migration: `MemoryComments.tsx` comment cards now use `background: var(--paper-2)` + `border: 1px solid var(--hairline)`, the author/timestamp/body switch to `var(--ink)` / `var(--ink-3)` / `var(--ink-2)`, textareas adopt the same paper/hairline/ink pattern used elsewhere in `/memories/page.tsx`, every primary action (Save / Post comment / Post reply) routes through the shared `Button` UI primitive (`variant="primary" size="sm"`) instead of hand-rolled `bg-[var(--accent)] text-white` strings, Cancel becomes `Button variant="ghost"`, inline Edit/Delete/Reply text-only actions read as `var(--ink-2)`, and confirm-delete uses `var(--clay-deep)` for the destructive action (consistent with the existing memories-page error color). `MemoryReactions.tsx` reaction pills switch resting state to `var(--paper-2)` + `var(--hairline)` + `var(--ink-2)` and pressed state to `var(--sage-tint)` + `var(--sage-deep)` (background + border + color); the hover rule lives in `globals.css` under `.memory-reaction-button` (paper-3 hover for resting, sage-soft hover for pressed) because Tailwind `hover:bg-[var()]` can't override an inline-style background — same pattern the `.ui-btn` variants already use. Error alerts in both components move from `text-red-400` to `var(--clay-deep)`. Behavior, semantic HTML, and all ARIA attributes are unchanged — every existing test still passes. Coverage: 7 new regression-pin cases (4 in `memoryComments.test.tsx` covering paper-token card background, paper textarea inline style, the `ui-btn` data-variant=primary post button, and clay-deep error color; 3 in `memoryReactions.test.tsx` covering resting paper tokens, pressed sage tokens, and clay-deep error color). 534 tests pass / 5 skipped (was 527/5; +7); `yarn lint` clean (0/0); `yarn build` green. Files: `src/components/MemoryComments.tsx`, `src/components/MemoryReactions.tsx`, `src/app/globals.css`, `src/__tests__/memoryComments.test.tsx`, `src/__tests__/memoryReactions.test.tsx`. Branch: `claude/vigilant-cannon-adplT`. Deferred: visual diff across remaining legacy-themed components (`AddMemoryModal`, `AddEventModal`, `AddFamilyModal`, `AddMemberModal`, `ImportGedcomModal`, `ConfirmDialog`, `Modal`, `error.tsx`, `global-error.tsx`, `EmptyState`, `ResidencesEditor`, `FamilyList`, `UngeocodedSidebar`, `ProfileEditForm`, `WelcomeModal`, `AuthHero`, `LoadingSpinner`, `ProtectedRoute`, `PlacePopup`, `GenealogyTree`/`FamilyTreeView`, `AudioPlayer`, plus `auth/callback`, `admin/seed`, `families/[id]/page.tsx` — all still carry dark-theme Tailwind classes); this PR's scope was the two components rendered *inside* already-migrated page shells, where the drift is the most visible.
- 2026-05-18 — **1.6 audit + SVG tree screen-reader pass (`claude/keen-newton-shlyv`).** Full sweep of the 1.6 "Remaining scope" list found that five of the nine bullets were already in place but not marked done: `alt` text on every `<img>` (verified across `ProfileAvatar`, `MemoryImage`, `ui/Avatar`, `ui/PhotoFrame`, and the lone inline preview in `AddMemoryModal`), focus trap in every modal (`Modal.tsx` handles trap + escape + scroll lock + focus restore, and all five real modals render through it; `ConfirmDialog` is inline buttons, not a modal), top-level `<main>` and `<nav>` landmarks (already in `app/layout.tsx` and `NavBar.tsx:197`), `aria-label` on every icon-only button (NavBar / family-tree / families / import-gedcom audits all clean), and the visible `*:focus-visible` outline (already in `globals.css:135` plus the SVG-aware tree override at `globals.css:225`). TODOS.md updated to strike those through. New substantive work in this branch: `src/components/GenealogyTree.tsx` labels the inner `<g>` wrapping all tree content with `role="group"` + an `aria-label` that names the visualization and explains the Tab / Enter / Space interaction; the shared `<defs>` block and every decorative edge `<path>` are now `aria-hidden="true"` so assistive tech surfaces only the focusable person nodes (which keep their existing `role="button"` + per-person `aria-label` from `TreeNode.tsx`). The tree was deliberately given `role="group"` rather than `role="tree"` because the W3C tree-widget pattern requires arrow-key roving tabindex, which is now tracked separately as 1.6.a. Coverage: 4 new Vitest cases in `src/__tests__/genealogyTreeA11y.test.tsx` (labelled group with usage hint, defs hidden, every edge path hidden, focusable buttons still nested inside the labelled group). 535 tests pass / 5 skipped (was 531/5; +4); `yarn lint` clean (0 / 0); `yarn build` green. Files: `src/components/GenealogyTree.tsx`, `src/__tests__/genealogyTreeA11y.test.tsx` (new), `TODOS.md`. Remaining 1.6 sub-items split out as 1.6.a (arrow-key tree nav), 1.6.b (section / article landmarks inside page bodies), 1.6.c (focus management after tree node click), 1.6.d (axe DevTools audit).
- 2026-05-10 — **T-17 Webhook-secret guard spot-check (no-op close).** Audited `src/app/api/webhooks/new-user/route.ts`. The header check is already in place: lines 26 and 29 require `SUPABASE_WEBHOOK_SECRET` to be set (500 on missing env), and lines 37 to 40 reject any request whose `x-webhook-secret` header does not match (401 on missing or wrong secret). Test coverage in `src/__tests__/webhookNewUser.test.ts` already pins all three failure modes: missing env vars (case at lines 53 to 59), wrong secret (lines 61 to 66), and missing header (lines 68 to 72), plus the full happy path with a valid secret. No code change required; T-17 closes as confirmed-secure. The unrelated duplicate `email` query param continues to be tracked under T-14. Files: `TODOS.md`.
- 2026-05-10 — **1.6 (highest-impact gap) — `TreeNode.tsx` keyboard + screen-reader support.** The three interactive `<g>` branches in `src/components/TreeNode.tsx` (single person, couple-left, couple-right) were mouse-only after the T-12 extraction — no `tabIndex`, `role`, `onKeyDown`, or `aria-label`. Now each branch carries `role="button"`, `tabIndex={0}` (`-1` when no person id), an `aria-label` derived from `node.data.name` (with `, born {birth}` or `, {birth} to {death}` appended for single-person nodes when dates are known), and an `onKeyDown` handler that routes `Enter` and `Space` through a shared `handleKeyActivate` helper to `onNavigate` (with `preventDefault` on `Space` so the page does not scroll). Visual focus is painted via a stroke-change rule in `src/app/globals.css` (`.tree-node-interactive:focus-visible > rect, .tree-node-interactive:focus-visible > circle { stroke: var(--sage-deep); stroke-width: 3 }`) — outline on SVG groups renders inconsistently across browsers (offset/border-radius are ignored), so a stroke change on the group's primary visible child is the more reliable focus indicator. The synthetic family-root label remains non-interactive (no role/tabindex/aria-label). Coverage: 9 new Vitest cases in `src/__tests__/treeNode.test.tsx` (single-person button role/tabindex/aria-label, dates baked into the label, Enter/Space activation, other keys ignored, Space `preventDefault`, family-root label non-focusable, couple-half per-side button roles + labels, per-side activation, `tree-node-interactive` class on every focusable group). 522 tests pass / 5 skipped (was 513/5; +9); `yarn lint` clean (0/0); `yarn build` green. Files: `src/components/TreeNode.tsx`, `src/app/globals.css`, `src/__tests__/treeNode.test.tsx`, `TODOS.md`. Branch: `claude/vigilant-cannon-hbeef`.
- 2026-05-09 — **T-16 Lint regression cleanup — restore 0/0 baseline.** UI refresh (PR #28) re-introduced `react-hooks/set-state-in-effect` warnings in three files plus two unused-import warnings; total 5 warnings, 0 errors. (TODO entry described it as "5 warnings in PhotoFrame.tsx" — actual breakdown was 3 set-state-in-effect across `src/components/ui/PhotoFrame.tsx`, `src/components/ui/Avatar.tsx`, and `src/components/NavBar.tsx`, plus unused `EmptyState` import in `src/app/family-tree/page.tsx` and unused `Icon` import in `src/app/timeline/page.tsx`.) Fixes: (1) `PhotoFrame` and `Avatar` now reset `failed` state via the render-time `prev*` pattern (matching `MemoryImage` / `ProfileAvatar`) instead of `useEffect(() => setFailed(false), [src])`. (2) `NavBar` switched to `useSyncExternalStore<Theme>(subscribeTheme, readTheme, () => "light")` with a module-level `themeListeners` `Set` pub/sub and an `applyTheme()` writer that updates the `<html>` class, persists to `localStorage`, and notifies listeners — replacing the `setTheme(readInitialTheme())` mount effect. The toggle button is gated behind `user`, which is null on SSR, so the `"light"` server snapshot is never user-visible. (3) Dropped the two unused imports. New tests: 2 cases (one each in `src/__tests__/ui/PhotoFrame.test.tsx` and `src/__tests__/ui/Avatar.test.tsx`) pin the regression — after a previous `src` errored, swapping in a new `src` re-renders the `<img>` (failed state must reset across the boundary). 513 tests pass / 5 skipped (was 511/5; added one regression-pin case to each of `PhotoFrame.test.tsx` and `Avatar.test.tsx`); `yarn lint` clean (0/0); `yarn build` green. Files: `src/components/ui/PhotoFrame.tsx`, `src/components/ui/Avatar.tsx`, `src/components/NavBar.tsx`, `src/app/family-tree/page.tsx`, `src/app/timeline/page.tsx`, `src/__tests__/ui/PhotoFrame.test.tsx`, `src/__tests__/ui/Avatar.test.tsx`, `TODOS.md`.
- 2026-05-08 — **T-13 Dynamic-import the D3 family tree on `/families/[id]`.** `PlacesMap` was already dynamically imported on `/places`; only the D3 side of T-13 was outstanding. `FamilyTreeView` (which statically imports `GenealogyTree` → `d3-zoom` + `d3-selection`, ~40 KB combined) was used in exactly one place — `src/app/families/[id]/page.tsx` — so the fix is a one-call-site change. Switched the page to `const FamilyTreeView = dynamic(() => import("@/components/FamilyTreeView"), { ssr: false, loading: ... })` with a same-height pulse skeleton, mirroring the `PlacesMap` pattern. `ssr: false` is required because `GenealogyTree` uses `ResizeObserver` and DOM refs that aren't available during SSR. To keep the placeholder in lock-step with the real tree's container so the layout doesn't shift on chunk land, hoisted the SVG container's `"85vh"` to a new shared `GENEALOGY_TREE_HEIGHT` constant in `src/config/constants.ts` (parallel to the existing `PLACES_MAP_HEIGHT`); both `GenealogyTree.tsx` and the page-level skeleton reference it. Coverage: 1 new `GENEALOGY_TREE_HEIGHT` case in `configConstants.test.ts` (CSS length pin), and a 4-case regression-pin file `familyPageDynamicImport.test.ts` that reads `families/[id]/page.tsx` and asserts (a) `next/dynamic` is imported, (b) `FamilyTreeView` is loaded via `dynamic(() => import("@/components/FamilyTreeView"))`, (c) no top-level `import FamilyTreeView from ...` regression has snuck back in, (d) `ssr: false` + a `loading` placeholder referencing `GENEALOGY_TREE_HEIGHT` are present. 470 tests pass / 5 skipped; lint clean (0 errors / 0 warnings); `yarn build` green (`/families/[id]` still appears as `ƒ` in the route table). Files: `src/app/families/[id]/page.tsx`, `src/components/GenealogyTree.tsx`, `src/config/constants.ts`, `src/__tests__/configConstants.test.ts`, `src/__tests__/familyPageDynamicImport.test.ts` (new). Deferred (T-13.a): real bundle-size measurement via `@next/bundle-analyzer` — Turbopack's stock build doesn't print per-chunk byte counts, so the savings claim is from package weights, not a measured before/after; out of scope here because it would mean adding a dev dependency and a build-mode toggle.
- 2026-05-08 — **UI refresh (PR #28).** Merged the `ui-refresh` branch as `c9a56f8`. Introduced a new design-system primitives module under `src/components/ui/` containing `Avatar.tsx`, `Button.tsx`, `Chip.tsx`, `Icon.tsx`, `PhotoFrame.tsx`, `SectionTitle.tsx`, `Wordmark.tsx`, plus a barrel `index.ts`. People page redesigned to use the new components. Substantial visual + structural change; no schema changes. **Known regression:** `PhotoFrame.tsx` ships with 5 `react-hooks/set-state-in-effect` lint warnings (`yarn lint` was previously 0/0); tracked as T-16 with a 15-minute fix using the same `prev*` render-time pattern that `MemoryImage` / `ProfileAvatar` adopted on 2026-04-29.
- 2026-05-08 — **Web Share API for invite links (`8742648`).** New `src/utils/share.ts` exports `shareInvite(payload: InviteShare): Promise<"shared" | "copied" | "cancelled">`. Uses `navigator.share` when available (and `navigator.canShare` to gate per-payload), falls back to `navigator.clipboard.writeText` with a "{text}\n{url}" composition so the recipient gets explanatory text alongside the URL instead of a bare link. `AbortError` from `navigator.share` is treated as user-cancelled rather than a failure (no clipboard fallback fires). 120-line `src/__tests__/share.test.ts` covers the share / copy / cancel branches. Wired into `src/app/families/[id]/page.tsx`, `src/app/profile/[id]/page.tsx`, and the home page invite affordance. No schema changes.
- 2026-05-08 — **Profile edit / invite-to-claim consolidation (`0c4801a`).** `src/app/profile/[id]/page.tsx` lost 44 lines, gained 4 — collapsed the previously-duplicated edit-mode + invite-to-claim UI flows into a single shared affordance. No behavior regression; it's a structural simplification on top of the post-redesign profile page.
- 2026-05-08 — **`AGENTS.md` agent workflow guide (`e8354a1`).** Documentation-only addition (PR #48). Captures the workflow conventions for agent-driven contributions to the repo.
- 2026-05-06 — **T-12 GenealogyTree node memoization + shared clip-path defs.** Pulled the per-node SVG render out of `src/components/GenealogyTree.tsx` (~150 inline lines, three branches: family-root label / couple / single person) and into a new `React.memo`-wrapped `TreeNode` component at `src/components/TreeNode.tsx`. The memoized `nodes` array, the per-iteration `LayoutNode` references, and the existing `useCallback`-wrapped `navigateToProfile` are all referentially stable across `treeData`-unchanged re-renders, so the inner JSX no longer rebuilds when the parent re-renders for unrelated reasons (today: dims/zoomBehavior state churn). Hoisted the three avatar `<clipPath>` definitions (single, couple-left, couple-right) into one shared `<defs>` block at the top of the SVG. The default `clipPathUnits="userSpaceOnUse"` resolves each clip in the *referencing* element's local coordinate system, so a single `<clipPath>` per variant covers every node — eliminating two `<defs><clipPath>` blocks per couple and one per single person (≈300 fewer SVG nodes on a 200-person tree). Click handlers, deceased styling, name truncation, and the `b. {date}` / `{birth} — {death}` date format are unchanged. Coverage: 11 new Vitest cases (`src/__tests__/treeNode.test.tsx`) cover family-root label rendering, single-person initials and photo variants (including shared `CLIP_ID_SINGLE` reference), single-node click navigation, deceased and living date formats, couple rendering with both halves and the couple-specific clip-paths, a regression pin that no per-node `<defs>` / `<clipPath>` blocks are emitted, click routing on each half of a couple, the shared right-side clip is positioned to the right of the left-side clip, and the memo `displayName` is preserved. 462 tests pass / 5 skipped; lint clean (0 errors / 0 warnings); `yarn build` green. Files: `src/components/TreeNode.tsx` (new), `src/__tests__/treeNode.test.tsx` (new), `src/components/GenealogyTree.tsx`. Deferred (T-12.a real-device frame-rate measurement on a seeded 100/250-person family — depends on T-11.a; T-12.b edge `<path>` memoization — minimal payoff, not worth doing in isolation). **Known follow-up surfaced 2026-05-08 audit:** the extracted `TreeNode.tsx` preserved the pre-existing a11y gap (no `tabIndex` / `role` / `onKeyDown` / `aria-label` on interactive `<g>` elements). Re-asserted as the highest-impact item in 1.6.
- 2026-05-06 — **1.3 On-this-day + birthday reminder digest emails.** Extended the existing cron-backed `src/app/api/notifications/digest/route.ts` instead of introducing a second notification pipeline. The route now loads the full family-scale `people`, `memories`, `events`, `memory_reactions`, and `memory_comments` datasets once, then hands them to the pure `src/utils/digest.ts` builder. For each due recipient (`daily` / `weekly` / `off` still comes from `app_users.notificationPrefs.digest`), the builder now adds three sections: activity on memories they created, birthdays for living people whose birthday fell since that recipient's last digest, and "on this day" anniversaries for memories/events whose source date recurred in the window and landed on a 1 / 5 / 10 / 25-year milestone. The email renderer in `src/lib/emails/memory-digest.ts` now produces combined subjects plus separate "Family birthdays", "On this day", and "New activity on your memories" sections, with HTML escaping preserved for every interpolated field. Assumption made explicitly: birthday reminders currently exclude deceased relatives, because those need different remembrance copy from a normal "turns X" birthday note. Tests: added coverage to the existing digest builder, digest route, and digest email template suites for mixed activity+reminder payloads, birthday/anniversary windowing, milestone filtering, deceased-person exclusion, and subject/body rendering. Also fixed unrelated pre-existing test typing failures in `deletePerson`, `memoryCommentsDb`, `memoryReactionsDb`, and `seedRouteAuth` so `npx tsc --noEmit`, `yarn lint`, and `yarn test` all pass again. Deferred: 1.3.a per-family local send time (+2h, requires timezone storage + schedule fan-out), 1.3.b remembrance birthdays for deceased relatives (+1h, separate UX decision).
- 2026-05-05 — **1.2.c Memory-activity email digest with token unsubscribe.** Migration `20260505_notification_prefs.sql` adds three columns to `public.app_users`: `notificationPrefs jsonb not null default '{"digest":"weekly","reactions":true,"comments":true}'::jsonb`, nullable `lastDigestSentAt timestamptz` (so the next run only includes activity after the last successful send; first-run baseline is the user's `createdAt` so brand-new accounts wait one cycle before their first email), and `unsubscribeToken uuid not null default gen_random_uuid()` with a unique index for token-based one-click opt-out. RLS is unchanged — both the digest and unsubscribe routes use the service role and bypass RLS, so the existing admin-only `app_users_admin_update` policy still gates user-facing writes (a `/settings` page is a deferred follow-up). Pure `src/utils/digest.ts` builder groups reactions and comments by memory creator and drops: pre-cycle activity, self-authored activity, activity on memories the recipient does not own, reactions/comments when the matching pref is `false`, and entire recipients when `digest === "off"` or the daily/weekly cadence has not elapsed. New `src/lib/emails/memory-digest.ts` renders the subject (correctly pluralizes and omits zero-count sides) and the HTML body, escaping every interpolated string so memory titles with quotes / angle brackets can't break out of the markup. New `src/app/api/notifications/digest/route.ts` (cron-driven) gates on `x-cron-secret`, reads `app_users` + `memory_reactions` + `memory_comments` + the referenced `memories` rows + each actor's display name from `people` + each recipient's email from the auth admin API, runs the builder, sends via `resend.batch.send` (chunks of 100), then PATCHes `lastDigestSentAt = now()` per recipient that received an email. New `src/app/api/notifications/unsubscribe/route.ts` accepts `?token=<uuid>`, validates the UUID shape locally (so malformed links short-circuit before any DB call), service-role looks up the row, sets `notificationPrefs.digest = "off"` while preserving the other fields, and returns a self-contained HTML page (no auth needed). Tests: 8 migration regex assertions (all three columns + unique index + lastDigestSentAt index + RLS-untouched + no-destructive + pgcrypto), 19 digest-builder cases (prefs normalization including unknown digest values, isDigestDue cadences, reaction/comment grouping with unique actors, self-exclusion, cycle-cutoff, non-owner exclusion, prefs muting, off-skip, ghost-actor fallback, missing-memory drop, multi-recipient), 5 email-template cases (subject pluralization, single-side fallback, generic fallback, HTML escaping of quotes / angle brackets, "Hi there" fallback), 7 digest-route cases (env-vars 500, missing/wrong cron secret 401, no app_users short-circuit, full happy path with batchSend assertion + lastDigestSentAt PATCH stamping, no-activity short-circuit, Resend rejection 500), and 7 unsubscribe-route cases (env-vars 500, missing/malformed token 400, already-unsubscribed 200, success preserves other prefs and writes the right userId, lookup 500, update 500). 478 tests pass; lint clean (0 errors / 0 warnings); `yarn build` green. `SUPABASE_SETUP.md` lists the new migration and documents the cron + env var setup for Supabase Cron / Vercel Cron. Deferred: 1.2.c.i self-service preferences UI (+2h, needs scoped self-update RLS policy on `app_users.notificationPrefs`), 1.2.c.ii real cron wiring (+30min once deployment target is decided).
- 2026-05-05 — **P0-5 Convert-image route locked behind `verifyUser`.** Extracted the previously inline `verifyUser` from `src/app/api/geocode/route.ts` into a shared helper at `src/lib/verifyUser.ts` so the same auth check now lives in one place. Wired it as the first line of the `POST` handler in `src/app/api/convert-image/route.ts` (returns `401 Unauthorized` before any `formData()` parsing or `heic-convert` work runs). The geocode route now imports the shared helper too — behavior unchanged. Client side, `convertWithServer` in `src/utils/heic.ts` now grabs the current Supabase access token via the existing `getAccessToken()` helper and forwards it as `Authorization: Bearer <jwt>` so the existing HEIC upload UX keeps working. New tests: 8 cases in `src/__tests__/verifyUser.test.ts` (missing env, missing header, malformed scheme, supabase 200, supabase 401, network throw, header forwarding, case-insensitive `bearer`); 8 cases in `src/__tests__/convertImageRoute.test.ts` (missing header / wrong scheme / rejected token / missing env all gate to 401, no `heic-convert` call when blocked, missing-file 400 after auth passes, JPEG passthrough, HEIC conversion path); 1 new case in `src/__tests__/heic.test.ts` pinning that the client sends the bearer token. The route test runs under `// @vitest-environment node` because the jsdom Request/FormData round-trip drops files. 402 tests pass / 5 skipped; lint clean (0 errors / 0 warnings); `yarn build` green.
- 2026-05-04 — **P0-4 Seed route locked to local development.** Both `POST` and `DELETE` on `/api/seed` previously used the Supabase service role key to write directly to the database with zero auth check, so any caller who knew the URL could seed fake rows or wipe the seed dataset (and, because the route uses the service role, RLS would not stop them). Picked the recommended option (b) from the TODO and gated both verbs behind `process.env.NODE_ENV === "development"` via a small `notFoundOutsideDev()` helper that returns `NextResponse(null, { status: 404 })` whenever `NODE_ENV` is anything other than `"development"`. Added a matching UX guard to `src/app/admin/seed/page.tsx` that early-returns a "Seeding is only available in local development" card in non-dev builds, so the buttons aren't visible while pointed at a route that will now 404. Coverage: 8 new Vitest cases (`src/__tests__/seedRouteAuth.test.ts`) — POST/DELETE 404 in production, POST/DELETE 404 in test (default vitest env), POST/DELETE never call `fetch` when blocked (proves the gate runs before any service-role network call), and POST/DELETE pass the gate when `NODE_ENV=development` (asserted via the existing 500 env-vars-missing path so the test doesn't need a full Supabase mock). 393 tests pass / 5 skip; lint clean; `yarn build` green. Files: `src/app/api/seed/route.ts`, `src/app/admin/seed/page.tsx`, `src/__tests__/seedRouteAuth.test.ts` (new), `TODOS.md`.
- 2026-05-02 — **P0-6 PostgREST filter injection in `parseIn` / `parseContains`.** The custom QueryBuilder's `.in()` and `.contains()` helpers in `src/lib/supabase.ts` wrapped each value in double quotes but never escaped internal `"` or `\`, so a user-typed name containing a quote (e.g. `Mary "Mae" Smith`) would close the quoted token mid-value and the rest of the string would be parsed as additional filter operands. Today every callsite happens to pass UUIDs, so no live exploit, but the sharp edge made the API unsafe to extend to user-typed values (places, names, search terms). Fix: extracted `\` → `\\` and `"` → `\"` into a pure shared helper `escapePgrstString` in `src/utils/pgrstEscape.ts` and routed both QueryBuilder helpers + the geocode route's `pgInValue` (previously inline-duplicated) through it. 13 new Vitest cases pin the escape contract, the `parseIn`/`parseContains` rendered output for inputs containing `"` and `\`, that PostgREST array-syntactic chars (`,`, `(`, `)`, `{`, `}`) pass through untouched, and a `URLSearchParams` round-trip so the escapes survive both URL-encode and percent-decode. 343 pass / 5 skip; lint clean; `yarn build` green. Files: `src/utils/pgrstEscape.ts` (new), `src/__tests__/pgrstEscape.test.ts` (new), `src/lib/supabase.ts`, `src/app/api/geocode/route.ts`.
- 2026-05-01 — **1.2.b Memory comments (threaded, one level deep).** Migration `20260501_memory_comments.sql` (+ rollback) adds `public.memory_comments (id, memoryId, userId, body, parentCommentId nullable, createdAt, updatedAt)` with cascade FKs on `memories(id)`, `auth.users(id)`, and self on `memory_comments(id)`; body length is constrained `between 1 and 4000` (after `btrim`); indexes on `memoryId`, `userId`, `parentCommentId`. A `before insert or update` trigger pins replies to one level deep (rejects with errcode `23514`); a `before update` trigger refreshes `updatedAt`. RLS gates SELECT on `is_approved_user()`, INSERT on approved + `userId = auth.uid()`, UPDATE on approved + owner only (no admin override on edit), DELETE on approved + (owner or admin). New `MemoryComment` model. New `listCommentsForMemory`, `listCommentsForMemories`, `addComment` (top-level + threaded replies), `updateComment`, `deleteComment` in `src/lib/db.ts`. New `MemoryComments.tsx` component renders the thread, fetches author display names via `people.userId` lookup, supports post / reply / in-place edit (with "(edited)" marker driven by `updatedAt > createdAt`) / confirm-then-delete (also drops the row's replies from local state), and shows a "Sign in to comment" nudge when signed out. Wired into the expanded memory card on `/memories`. Coverage: 14 migration cases (`memoryCommentsMigration.test.ts`), 8 db cases (`memoryCommentsDb.test.ts`), 11 component cases (`memoryComments.test.tsx`). 358 tests pass; lint clean; `yarn build` green. `SUPABASE_SETUP.md` lists the new migration. Deferred (call out in PR for review): 1.2.b.i surface comments on profile-page memory tiles (compact tiles can't hold a textarea — needs a "View (N)" link or popover); 1.2.b.ii bulk-fetch comments per page on `/memories` so each tile receives `initialComments` instead of doing N round-trips on first paint.
- 2026-05-01 — **1.2.d Bulk reaction fetch on profile page.** `/profile/[id]` now bulk-fetches all reactions for the page's memories in one PostgREST `in.()` round trip (alongside the existing `Promise.all`), groups them by memoryId via the new pure `groupReactionsByMemoryId(ids, rows)` util in `src/utils/groupReactions.ts`, and passes the slice down as `initialReactions` to every `<MemoryReactions />` tile — replacing the previous N per-tile `eq.` fetches with a single `in.` fetch. The same path runs again from `AddMemoryModal.onCreated` so a freshly-added memory still gets a real (empty) reactions bucket without a per-tile spinner. `/memories` is intentionally left unchanged: it renders `MemoryReactions` only on the *expanded* tile (one at a time, post-click), so a page-level bulk fetch would preload reactions the user may never see and the per-tile fetch is already amortized across user intent. The pre-existing component test "does not fetch when initialReactions is provided" pins that supplying the bulk data prevents the per-tile fetch entirely. 6 new Vitest cases in `src/__tests__/groupReactions.test.ts` (empty-ids, empty-rows seed, bucket grouping with relative-order preservation, drop stale memoryIds, duplicate-id de-dup, input immutability pin). 336 tests pass / 5 skip; lint clean; `yarn build` green. Files: `src/app/profile/[id]/page.tsx`, `src/utils/groupReactions.ts` (new), `src/__tests__/groupReactions.test.ts` (new), `TODOS.md`.
- 2026-05-01 — **Bug: escape user-typed wildcards in `ilike` searches.** The custom Supabase QueryBuilder's `ilike()` passed user input straight into the LIKE pattern, so a user typing `%`, `_`, `*`, or `\` in any search box hit Postgres / PostgREST wildcards instead of literal characters. Concrete failures: searching for `_` matched every name, `100%` matched anything containing `100`, `Mary*` matched everything starting with `Mary`. Fix: new `src/utils/likeEscape.ts` exports `escapeLikePattern(s)` that prefixes each `\`, `%`, `_`, and `*` with a backslash (Postgres' default LIKE escape). Applied at all 9 call sites: `NavBar` global search (people + families), `AddMemoryModal` person tag, `AddEventModal` person tag, `AddMemberModal` person search, `AddFamilyModal` family search, `db.ts` `autoLinkToFamilyByLastName` (case-insensitive last-name match), `userPersonLink.tsx` claim-by-firstName/lastName lookup. Coverage: 10 new cases in `src/__tests__/likeEscape.test.ts` (empty / alphanumeric / each special char / mixed / repeated / contract pin for already-escaped input / URL-encoding round-trip through `URLSearchParams`). Bookend `%` wildcards added by callers stay live so contains/starts-with semantics are preserved — only the user-supplied substring is escaped. All 269 tests + lint + `yarn build` pass.
- 2026-05-01 — **Codebase audit #2 (security, performance, a11y, code quality).** Full audit found 3 new P0 security issues (P0-4 seed route no auth, P0-5 convert-image no auth, P0-6 PostgREST filter injection), 4 new tech debt items (T-12 SVG memoization, T-13 dynamic imports, T-14 webhook duplicate filter, T-15 middleware), and specific accessibility gaps in GenealogyTree (added to 1.6). Clean bill on conventions: zero `any`, zero `else` blocks, no `dangerouslySetInnerHTML`, no leaked secrets, `.env` properly gitignored, error boundaries in place.
- 2026-04-30 — **T-5 soft-delete (partial — admin restore UI + cron hard-purge deferred).** Migration `20260430_soft_delete.sql` adds `deletedAt timestamptz` to `people`, `families`, `events`, `memories` (rollback included), plus partial `where deletedAt is null` indexes per table. `deletePerson` / `deleteEvent` / `deleteMemory` / `deleteFamily` now issue `UPDATE … SET "deletedAt" = now()` rather than `DELETE`. Bidirectional ref strip is removed from `deletePerson` so restore is a one-column reset; dangling refs are tolerated by `treeBuilder` and the list-by-id helpers because every read filters `deletedAt is null`. Filter applied across `lib/db.ts` (paginated + non-paginated `listPeople`/`listEvents`/`listMemories`/`listFamilies`, `getPersonById`, `listPeopleByIds`, `listMemoriesForPerson`, `listEventsForPerson`, `listFamiliesForPerson`, `autoLinkToFamilyByLastName`) and every direct `supabase.from(…).select(…)` outside `lib/db.ts` (NavBar search + own-person resolve, FamilyTreeView, AddMemberModal/AddMemoryModal/AddEventModal person search, events/memories/families pages, userPersonLink claim flow). RLS is unchanged. 24 new Vitest cases (`softDeleteMigration.test.ts` + rewritten `deletePerson.test.ts`); component test mocks for the new `.is()` chain segment updated in `addMemberModalErrorHandling`, `addMemoryModalAudio`, `addMemoryModalBlobUrls`. `SUPABASE_SETUP.md` documents the migration + the SQL one-liner restore. 289 tests pass, 5 skipped; lint clean; `yarn build` green. Deferred (T-5.a admin trash UI, T-5.b hard-purge cron, T-5.c Storage cleanup on purge, T-5.d "Move to trash" copy) tracked under T-5 entry.
- 2026-04-29 — **1.2.a Memory reactions.** New `public.memory_reactions` table (migration `20260429_memory_reactions.sql` + rollback) with `unique (memoryId, userId, emoji)`, emoji `check` locked to `❤️ 😂 🙏 😮`, cascade FKs to `public.memories` and `auth.users`, per-column indexes. RLS uses the existing `is_approved_user()` / `is_admin_user()` helpers: SELECT for any approved user, INSERT for approved + `userId = auth.uid()`, DELETE for approved + (owner or admin); UPDATE is intentionally not granted (immutable rows). New `MemoryReaction` model and `REACTION_EMOJIS` / `REACTION_LABELS` constant module. `src/lib/db.ts` gains `listReactionsForMemory`, `listReactionsForMemories`, `addReaction`, `removeReaction`. New `MemoryReactions.tsx` component does optimistic add/remove with rollback-on-failure, full `aria-pressed` + `aria-label` (count + "you reacted" affordance), and disables itself when the viewer isn't signed in. Wired into the expanded memory card on `/memories` and into the per-tile rendering on the profile-page memories grid. Coverage: 11 migration regex assertions (table shape, FK cascades, unique constraint, RLS gates, no-destructive guarantee, indexes, rollback contents), 7 component cases (zero-state render, count aggregation + pressed state, optimistic add, rollback + alert on failure, optimistic remove, signed-out disable, fetch-on-mount, no-fetch-when-initial-supplied), 6 db cases (URL filters, empty short-circuit, `in` filter build, insert body, error propagation, full delete tuple). 305 tests pass; lint clean; `yarn build` green. Splits 1.2 into three remaining sub-tasks (1.2.b comments, 1.2.c email digest, 1.2.d bulk reaction fetch) — see entry under Phase 1.
- 2026-04-29 — **Lint cleanup: eliminate React 19 `set-state-in-effect` + `exhaustive-deps` warnings.** ESLint with the React 19 ruleset was flagging 11 warnings across 9 files (9 × `react-hooks/set-state-in-effect`, 2 × `react-hooks/exhaustive-deps`). All 11 fixed; lint baseline is now 0 errors / 0 warnings. Patterns applied: (1) **render-time `prev*` tracking** for "reset state when prop changes" — `ProfileAvatar` (error reset on `src` swap), `ResidencesEditor` (form reset when row prop swaps), `AddMemberModal` (clear results when search empties), `NavBar` (search clear, person-id reset on user logout, menu close on pathname change). All four mirror the existing `MemoryImage` pattern. (2) **`useSyncExternalStore`** for read-once-from-browser-API-on-mount — `WelcomeModal` (localStorage seen flag with SSR-safe `getServerSnapshot`), `reset-password/page.tsx` (URL hash via `hashchange` subscription). (3) **`useSearchParams`** + `Suspense` boundary — `login/page.tsx`, replacing the manual `window.location.search` parse. (4) **`useCallback`** for fetch functions referenced from effects — `events/page.tsx`, `memories/page.tsx`. Reset-password page also extracted a pure `parseRecoveryHash` function (now exported) so the validation logic is unit-testable in isolation. New tests: `profileAvatar.test.tsx` (4 cases incl. error-reset-on-src-change regression pin), `welcomeModal.test.tsx` (4 cases for localStorage gating + dismissal), `parseRecoveryHash.test.ts` (8 cases for empty / bad-type / missing-token / valid / malformed-jwt / no-leading-`#`). 259 tests passing total (243 → 259), `yarn lint` clean, `yarn build` green. Files: `src/components/ProfileAvatar.tsx`, `src/components/ResidencesEditor.tsx`, `src/components/AddMemberModal.tsx`, `src/components/NavBar.tsx`, `src/components/WelcomeModal.tsx`, `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/events/page.tsx`, `src/app/memories/page.tsx`, plus 3 new test files.
- 2026-04-28 — **1.5 Relationship calculator.** New `src/utils/relationship.ts` exports `findRelationship(personAId, personBId, peopleById): RelationshipResult | null`. BFSes upward through `Person.parentIds`, finds the lowest common ancestor, and translates (stepsA, stepsB) into a human-readable English label: "Self", "Spouse", "Parent" / "Grandparent" / "Great-grandparent" / "Nx-great-grandparent", mirrored child labels, "Sibling", "Aunt / Uncle" with `Great-` prefixes, "Niece / Nephew" with `Great-` prefixes, and cousins as `{ordinal} cousin {N times} removed`. Result also returns `kind`, `stepsA`, `stepsB`, and `commonAncestorId`. Profile page renders a "Your {relationship}" chip in the header card whenever the viewing user has a linked person and isn't viewing their own profile. 26 new Vitest cases in `src/__tests__/relationship.test.ts` (243 tests total, lint clean, `yarn build` green). Deferred: in-laws (1.5.a), half-sibling labels (1.5.b), step/adoptive distinction (1.5.c), standalone `/relationships` page (1.5.d).
- 2026-04-28 — **UX: reframe person pages around remembrance.** Driven by user feedback ("I feel sortof weird making a profile for my dead parents"). Dropped "profile" as a user-facing noun across 7 files — replaced with the person's name on page titles, "Edit details" / "Edit my details" on action buttons, "My page" in the nav dropdown, and softened the Biography / Family / Family-Groups empty states. For deceased people (gated on `person.deathDate`), the page now leads with remembrance: primary CTA is "Share a memory of {firstName}" (wired to the existing `AddMemoryModal` `preTaggedPersonId` prop), the "Edit details" button is secondary, the empty Biography reads "What do you remember about {firstName}?" with a primary "Share a memory" button + quiet "Or edit details" link, and the Memories empty state reads "Be the first to share a memory of {firstName}." Living-person pages get the copy pass only — functional UX unchanged. The existing memorial banner ("In loving memory of …") was kept as-is. No schema changes; the `/profile/[id]` route stays for bookmark stability. Files: `src/app/profile/[id]/page.tsx`, `src/components/NavBar.tsx`, `src/components/WelcomeModal.tsx`, `src/app/page.tsx`, `src/app/signup/page.tsx`, `src/components/AddMemberModal.tsx`, `src/app/places/page.tsx`. Lint clean (0 errors), 217 tests passing, `yarn build` green.
- 2026-04-27 — **1.1 Voice / audio memories (recording + playback).** Migration `20260427_memory_audio.sql` adds nullable `audioUrl` + `durationSeconds` to `public.memories` (rollback included; RLS unchanged). `AddMemoryModal` gains a `MediaRecorder`-based record/stop/discard/re-record flow with live elapsed time, codec negotiation (`isTypeSupported`), graceful fallback when the browser lacks `MediaRecorder`/`getUserMedia`, and full cleanup of streams + blob URLs on unmount. New `uploadMemoryAudio()` (with `audioExtensionFor()` MIME→ext mapping) writes audio to `people/{personId}/memories/audio/{ts}.{ext}` under the existing allowlist-gated `media` bucket. New shared `formatDuration()` utility and `AudioPlayer` component drop-in to the expanded memories list and profile memories grid; the collapsed memory card surfaces a "voice" indicator. Coverage: 19 new Vitest cases across 5 files; all 217 tests pass; lint clean; `yarn build` green. Whisper transcription explicitly deferred as 1.1.a; real-device microphone QA folded into T-10.
- 2026-04-27 — **P0-3 verify stub vs. implemented pages.** Closed as duplicate; the audit was completed under the Verification tasks (items 1-3) and the only gap surfaced (route naming) was already shipped as T-9 on 2026-04-24. Re-audit on 2026-04-27 confirmed every file in the original list is a real, working implementation (not a placeholder): `timeline/page.tsx` (204 lines), `families/page.tsx` (166 lines), `families/[id]/page.tsx` (164 lines, post-T-9 move), `login/page.tsx` (110 lines), `signup/page.tsx` (175 lines).
- 2026-04-26 — **T-11 genealogy tree perf + pan/zoom fix.** Pure layout functions extracted to `src/utils/treeLayout.ts`; `layoutTree` memoizes subtree widths (O(n²) → O(n)); `GenealogyTree` memoizes layout output and splits zoom-setup from initial-fit so user pan/zoom isn't reset on parent re-renders; `ResizeObserver` for dims; "Reset view" button preserves centering; 11 new Vitest cases (`treeLayout.test.ts`). Deferred: live measurement on a seeded 50/100/250-person family.
- 2026-04-25 — **P0-2 trust boundary documentation.** Added a "Trust model and access" section to `README.md` that states the single-family assumption, explains the `app_users` allowlist gate, and notes that ownership rules cover mutations but not reads. Branch-level isolation remains a future ~16h scope.
- 2026-04-25 — **T-4 error boundaries.** Replaced layout-level class `ErrorBoundary` with idiomatic `src/app/error.tsx` (per-route) + `src/app/global-error.tsx` (root). `reset()` now actually re-renders the segment instead of just flipping local state. Dev shows full message; prod shows only `error.digest` as a support reference. Old component deleted; 8 new Vitest cases added.
- 2026-04-24 — **T-9 route naming alignment.** `/family/[id]` moved to `/families/[id]`; six internal `Link` call sites updated; legacy path gets a 307 redirect in `next.config.ts`; regression test added.
- 2026-04-24 — **T-1 extract hard-coded constants.** New `src/config/constants.ts` centralizes `PAGE_SIZE` per list, `HOME_RECENT.*` counts, `NOMINATIM_MIN_MS_BETWEEN_CALLS`, and `PLACES_MAP_HEIGHT`. Eight files updated to consume it; `configConstants.test.ts` adds 5 invariants. All 176 tests + build pass.
- 2026-04-23 — Verification tasks (all six sub-items). README + SUPABASE_SETUP.md refreshed. Follow-ups filed as T-9, T-10, T-11.
- 2026-04-23 — **P0-1 RLS lockdown.** Added `public.app_users` allowlist + `is_approved_user` / `is_admin_user` SECURITY DEFINER helpers, replaced every blanket `using (true)` policy on data tables and the media bucket, gated destructive ops on creator-or-admin. Back-fill seeds existing `auth.users` to avoid lockout; admin promotion is a manual follow-up (see `SUPABASE_SETUP.md`). Rollback migration included. Static migration-structure test + opt-in Vitest integration test (`RUN_RLS_INTEGRATION=1`).
- 2026-04-23 — **T-7 no-else refactor.** 20 `else` / `else if` occurrences eliminated across 9 files; added 3 regression tests for the GEDCOM parser control-flow changes. Codebase now fully conforms to the CLAUDE.md "no `else` blocks" rule.
