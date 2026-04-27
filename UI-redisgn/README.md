# Handoff: Family Tree UI Refresh

## Overview

A full visual refresh of the Family Tree (née "Family Legacy") app — a genealogy / memory-keeping app for documenting a family's story across people, relationships, events, and memories, built for a mixed-age, mostly non-technical audience.

The refresh replaces the current warm-dark tan/gold-on-near-black treatment with a **calm, editorial, paper-like aesthetic** — sage + cream, serif display (Fraunces) paired with a clean sans (Inter), hairline rules and plenty of whitespace. It's designed to feel more like a handmade keepsake book than a productivity app, while staying legible and obvious for non-technical users.

Eleven screens are covered: **Home, People, Tree, Profile, Timeline, Places, Memories, Events, Families, Auth, Empty state.** A refreshed Profile page is the showpiece — laid out as a long-scroll digital memoir with hero, pull quote, vital details, family constellation, chapters, voices, and photo gallery.

## About the Design Files

The files in `prototype/` are **design references created in HTML** — high-fidelity mockups showing intended look, layout, copy tone, and interaction affordances. They are **not production code to copy directly**.

Your task is to **port the visual system and page layouts into the existing Next.js / React / Tailwind 4 codebase** at `family-tree/`, replacing the current styling while preserving the existing functionality, data models, auth, and routing.

The prototype uses inline React + Babel + a single `tokens.css` file. You will translate this into the codebase's existing pattern: Tailwind 4 tokens in `globals.css`, React components under `src/components/`, Next.js app-router pages under `src/app/`.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and layouts are final. Recreate pixel-perfectly using Tailwind utility classes driven by the design tokens defined below.

## Target Codebase

- **Framework**: Next.js 15 (app router) + React 19
- **Styling**: Tailwind CSS v4 (CSS-first config via `@import "tailwindcss"` + `:root` variables in `src/app/globals.css`)
- **Existing font setup**: Geist Sans + Geist Mono via `next/font/google` in `src/app/layout.tsx` — **replace with Fraunces + Inter**
- **Existing palette** (to be replaced entirely): `#0c0f17` bg, `#e8e6e3` fg, `#c4956a` accent

## Design Tokens

Port these into `src/app/globals.css` under `:root` (and a `.theme-dark` scope for dark mode). Full source: `prototype/lib/tokens.css`.

### Colors — Light (default)

```css
/* Paper surfaces */
--paper:           #f6f1e7;   /* primary background */
--paper-2:         #efe8d8;   /* section bands, cards */
--paper-3:         #e7dfcc;   /* deeper emphasis */

/* Ink (text) */
--ink:             #1f2a24;   /* primary */
--ink-2:           #3a4a42;   /* body prose */
--ink-3:           #6b7b72;   /* muted / captions */
--ink-4:           #93a298;   /* quiet metadata */

/* Hairlines / borders */
--hairline:        #d9cfb8;
--hairline-strong: #bfb498;

/* Sage — primary brand accent */
--sage:        #6b8674;
--sage-deep:   #4a6555;   /* primary buttons, emphasis */
--sage-soft:   #cfd9c8;   /* borders on tinted surfaces */
--sage-tint:   #e4ebdf;   /* tinted section backgrounds */

/* Clay — rare warm accent (birthdays, "today", emphasis) */
--clay:        #c48760;
--clay-deep:   #a56c48;
--clay-tint:   #f1dfcc;
```

### Colors — Dark mode

```css
.theme-dark {
  --paper:   #161b18;
  --paper-2: #1d2420;
  --paper-3: #252d28;
  --ink:     #ece6d6;
  --ink-2:   #c5bfaf;
  --ink-3:   #8f9084;
  --ink-4:   #6a6c62;
  --hairline:        #2f3832;
  --hairline-strong: #3f4942;
  --sage:       #8fae97;
  --sage-deep:  #6b8674;
  --sage-soft:  #364239;
  --sage-tint:  #222a24;
  --clay:       #d7a37e;
  --clay-deep:  #c48760;
  --clay-tint:  #3a2c22;
}
```

### Typography

```css
--font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
--font-body:    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

**Fraunces** — display serif used for names, headlines, eyebrow-adjacent labels, and all italic pull quotes. Weight 400–500 for most display; the italic is a key visual device (used for middle names, pull quotes, and section emphasis).

**Inter** — sans body and UI chrome, 400/500/600/700.

Load via `next/font/google` in `layout.tsx`:

```ts
import { Fraunces, Inter } from "next/font/google";
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
```

### Typography scale

| Use | Size | Weight | Family | Notes |
|---|---|---|---|---|
| Display XL (hero name) | 108px | 400 | Fraunces | letter-spacing -0.035em, line-height 0.92 |
| Display L (section title) | 44–48px | 400–500 | Fraunces | letter-spacing -0.02em |
| Display M (card title) | 26–36px | 500 | Fraunces | |
| Display S (name row) | 18–22px | 500 | Fraunces | |
| Body L (lede) | 17–18px | 400 | Inter | line-height 1.6–1.7, color `--ink-2` |
| Body | 15px | 400 | Inter | line-height 1.5, color `--ink` |
| UI | 14px | 500 | Inter | |
| Small | 13px | 400–500 | Inter | |
| Caption | 11–12px | 400 | Fraunces italic | color `--ink-3` |
| Eyebrow | 11px | 600 | Inter | uppercase, letter-spacing 0.14em, color `--ink-3` |

### Radii

```
--r-sm:  6px;   --r-md: 10px;   --r-lg: 14px;   --r-xl: 20px;   --r-2xl: 28px;
```
**Buttons use `999px` (pill).** Photos use small radii: **2–6px** — this is deliberate, keeps the editorial/print feel.

### Shadows

```css
--shadow-xs: 0 1px 2px rgba(31, 42, 36, 0.06);
--shadow-sm: 0 1px 2px rgba(31, 42, 36, 0.05), 0 2px 8px rgba(31, 42, 36, 0.06);
--shadow-md: 0 4px 16px rgba(31, 42, 36, 0.08), 0 1px 3px rgba(31, 42, 36, 0.05);
--shadow-lg: 0 12px 40px rgba(31, 42, 36, 0.12), 0 2px 6px rgba(31, 42, 36, 0.06);
```

### Spacing

Standard Tailwind scale. Screens use generous padding — `48–64px` horizontal on desktop is the norm. Chapter/story padding is `72px` vertical at the extreme.

### Alternate palettes (optional, exposed as Tweaks in prototype)

- `palette-dust` — dust-rose warm neutral
- `palette-library` — navy + gold editorial
- `palette-heirloom` — warm brown

These are scoped CSS classes that override the sage tokens. Not required in v1, but the hooks are worth preserving.

## Core Primitives to Build

Port these from `prototype/lib/primitives.jsx` into `src/components/ui/`. The prototype uses inline styles; rewrite with Tailwind utility classes that reference the CSS variables above.

1. **`<NavBar>`** — top nav with wordmark on the left, link pills in the center, search pill + theme toggle + avatar on the right. Active link has a `--paper-2` background pill.
2. **`<Wordmark>`** — custom SVG mark (branching dots) + "Family Legacy" set in Fraunces.
3. **`<Avatar>`** — round, `--sage-tint` bg, Fraunces initials fallback. **Must have `onError` fallback** that swaps to initials if the image fails to load. Sizes: 28, 36, 40, 44, 64.
4. **`<PhotoFrame>`** — aspect-ratio box with `objectFit: cover`, optional 1px hairline border + `--shadow-sm` (`frame` prop). **Must have `onError` fallback** to a striped placeholder (see `.photo-placeholder` in tokens.css).
5. **`<Button>`** — three variants: `primary` (`--sage-deep` bg, `--paper` text), `ghost` (transparent, hairline border), `quiet` (`--paper-2` bg). Pill shape. Supports `icon` prop and `sm`/`md`/`lg` sizes.
6. **`<Chip>`** — pill tag in three tones: `default`, `sage`, `clay`. Optional leading icon.
7. **`<SectionTitle>`** — eyebrow + display H2 + optional subtitle + optional right-aligned action.
8. **`<Icon>`** — hairline 20px-viewBox icons, `strokeWidth=1.5`, `strokeLinecap="round"`. Full set of 25+ names is defined in `primitives.jsx`. Keep this simple SVG-path approach rather than pulling in lucide/heroicons — the hairline weight is part of the aesthetic.

## Icon Set

Copy the `iconPaths` object verbatim from `prototype/lib/primitives.jsx`. Names: `people, tree, timeline, heart, memory, place, event, search, plus, arrow, chevronRight, close, edit, photo, bell, settings, filter, globe, sparkle, moon, sun, grid, list, check, cake, book, clock, pencil`.

## Screens

Each prototype screen corresponds to a real route in the codebase. Map:

| Prototype | Codebase route | Source file |
|---|---|---|
| Home | `src/app/page.tsx` | `prototype/screens/home.jsx` |
| People | `src/app/family-tree/page.tsx` (list view) | `prototype/screens/core.jsx` → `PeopleList` |
| Tree | `src/app/family-tree/page.tsx` (tree view) | `prototype/screens/core.jsx` → `TreeView` |
| **Profile** | `src/app/profile/[id]/page.tsx` | `prototype/screens/core.jsx` → `Profile` |
| Timeline | `src/app/timeline/page.tsx` | `prototype/screens/core.jsx` → `TimelineView` |
| Places | `src/app/places/page.tsx` | `prototype/screens/secondary.jsx` |
| Memories | `src/app/memories/page.tsx` | `prototype/screens/secondary.jsx` |
| Events | `src/app/events/page.tsx` | `prototype/screens/secondary.jsx` |
| Families | `src/app/families/page.tsx` | `prototype/screens/secondary.jsx` |
| Auth | sign-in/sign-up | `prototype/screens/secondary.jsx` |
| Empty state | reused pattern | `prototype/screens/secondary.jsx` |

### Profile page — detailed spec

This is the showpiece. It's a long-scroll digital memoir, NOT a dashboard. Structure top-to-bottom:

1. **Breadcrumb bar** — "People › Eleanor May Barcroft", right side has small ghost buttons for "Edit" and "Print as book".
2. **Hero** — two-column grid (`1fr 440px`), left has eyebrow "A life · Volume I" + 108px name (first name with italic middle name in `--sage-deep`) + facts row (b. year, city→city, italic nickname) + 18px lede paragraph. Right has `PhotoFrame` ratio 4/5 with italic centered caption below. Bottom hairline.
3. **Pull quote band** — full-width `--paper-2` background, 72px vertical padding, centered max-width 820px. Enormous italic curly quote (96px Fraunces italic, `--sage-deep`), 34px italic pull quote, eyebrow attribution below.
4. **Vital details + Family constellation** — two columns (380px + 1fr). Left: `<dl>` with 7 facts (Born, Birthplace, Lives in, Married, Children, Grandchildren, Known for). Right: three sub-columns labeled "married to" / "mother to" / "grandmother to" in italic muted script, with `FamilyCard` rows under each.
5. **Hairline divider** (not a full border — just a 1px line inset from the page edges).
6. **Chapters of a life** — centered heading "Seventy-three years, _in her own thread_". Max-width 1040px column. Five `<Chapter>` articles each with: left rail (120px, sticky) showing a 56px italic roman numeral in `--sage-deep` + eyebrow era label; right column with 30px title, 17px body prose, optional pull quote with 2px sage left border, optional photo grid (1 or 2 photos with italic captions).
7. **Letters & voices** — `--sage-tint` full-width band. Three figure cards in a 3-column grid, each with blockquote (19px italic) + attribution row (avatar + name + "her {relationship}") separated by a hairline.
8. **Photo gallery** — "In the frame · 247 photos" heading with "See all" ghost button. 12-column grid: one tall 4/5 photo spans 5 columns on the left, right side has a 2×2 mosaic of mixed ratios. Every photo has an italic caption below.
9. **Colophon footer** — centered sparkle icon between two short hairlines, italic "Profile kept by Margaret, Isaac, and 4 others. Last updated April 2026."

The full Profile source with exact spacing, copy, and layout is in `prototype/screens/core.jsx`.

### Home page — key elements

Opens with a big editorial hero (name + "today in the family" date/weather-of-the-family feeling), upcoming birthdays strip, "recent memories" editorial gallery, "on this day" historical callback, family activity feed. See `prototype/screens/home.jsx`.

## Interactions & Behavior

- **Navigation**: existing Next.js routing — preserve all current routes and data flow.
- **Theme toggle**: add a light/dark toggle in the NavBar. Store preference in `localStorage` + toggle `theme-dark` class on `<html>` or `<body>`.
- **Avatar image fallback**: `onError` handler in the Avatar component sets a `failed` state and renders initials instead. Same pattern for `PhotoFrame` → striped placeholder.
- **Buttons**: hover state darkens primary to `--ink`, ghost adds `--paper-2` background. 150ms ease transitions on all interactive elements.
- **Focus rings**: 2px solid `--sage-deep`, offset 2px, radius 4px. Do not remove focus outlines.
- **Hairline cards**: 1px `--hairline` border, `var(--shadow-sm)` on hover.
- **Keep all existing CRUD flows working** — add/edit person, add memory, upload photo, invite family member. The refresh is visual; behaviors stay.

## State Management

No new state requirements. Preserve existing auth (`AuthProvider`), data fetching, form state, and routing.

## Assets

- **Fonts**: Fraunces + Inter via `next/font/google`. Remove Geist imports.
- **Icons**: inline SVG, no icon library needed. Port the `iconPaths` object.
- **Photos**: prototype uses Unsplash URLs as stand-ins. In the real app, use user-uploaded photos from Supabase storage as currently wired.
- **Wordmark SVG**: reuse the inline SVG from the Wordmark component.

## Implementation Order (suggested)

1. Replace fonts + palette in `globals.css` and `layout.tsx`. Nothing else — sanity-check the raw color change.
2. Build the `ui/` primitives (`Avatar`, `PhotoFrame`, `Button`, `Chip`, `Icon`, `SectionTitle`, `Wordmark`).
3. Port `NavBar.tsx` to the new design.
4. Port the **Profile** page — the biggest aesthetic win and the best pattern-setter for the rest.
5. Port Home, then the other top-level routes.
6. Add theme toggle + `.theme-dark` wiring.
7. QA against the prototype screens one-by-one.

## Files in this Package

- `README.md` — this file
- `prototype/Family Legacy UI Refresh.html` — the full design canvas (open in a browser to see all screens)
- `prototype/lib/tokens.css` — complete design token source
- `prototype/lib/primitives.jsx` — all reusable components with exact styles
- `prototype/lib/data.jsx` — fixture data for people, memories, events, tree, places
- `prototype/screens/home.jsx` — home screen
- `prototype/screens/core.jsx` — people list, tree, **profile**, timeline
- `prototype/screens/secondary.jsx` — memories, events, places, families, auth, empty

## Notes

- The codebase's existing `CLAUDE.md` at `family-tree/CLAUDE.md` has guidance on its own conventions — follow those for file structure, naming, and testing.
- The `--clay` accent is rare — reserve it for birthdays, "today" markers, and emphasis. Don't overuse.
- The serif italic is a load-bearing visual device. Any time a name, relationship label, or quoted phrase wants warmth, use `font-family: var(--font-display); font-style: italic`.
- Photo radii stay small (2–6px). Resist rounding them more — part of the "printed page" feel.
- Avoid gradients, emoji, and AI-slop tropes. The aesthetic is editorial, hand-kept, quiet.
