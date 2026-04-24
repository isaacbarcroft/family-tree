# Family Tree

A modern family tree app for documenting your family's story — people, relationships, events, and memories — all in one place. Built for non-technical users who want a simple, warm experience.

## Features

- **People & Relationships** — Add family members with profiles, photos, and link parent/child/spouse relationships
- **Family Groups** — Organize people into family units
- **Interactive Family Tree** — Visualize relationships with a D3-powered tree view
- **Events** — Track milestones like weddings, graduations, reunions, and more
- **Memories** — Upload photos and stories tied to people and dates
- **Timeline** — See your family's history laid out chronologically
- **Upcoming Birthdays** — Dashboard highlights who's celebrating soon
- **Search** — Find people quickly from the navbar (desktop and mobile)
- **Ownership Controls** — Users can only edit/delete content they created; admins can manage anyone's content
- **Allowlist Access** — Access is gated on an `app_users` allowlist, so a stray signup cannot read or change family data until an admin adds them

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack) + React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (profile photos, memory images)
- **Visualization:** D3 (d3-selection + d3-zoom) for the family tree, Leaflet + react-leaflet for the places map
- **Email:** Resend (transactional)
- **Testing:** Vitest + Testing Library
- **Package Manager:** Yarn 1.22

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn (`npm install -g yarn`)
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/family-tree.git
cd family-tree
yarn install
```

### 2. Set up environment variables

Copy the example and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

You can find these in your Supabase Dashboard under **Settings > API**.

### 3. Set up the database

Run the migrations against your Supabase project (in order):

```bash
supabase db push
```

Or manually execute each SQL file in `supabase/migrations/` via the Supabase SQL Editor, in filename order:

1. `20260309_initial_schema_and_rls.sql` (tables, baseline RLS, storage bucket)
2. `20260419_places.sql` (places + geocoding support)
3. `20260419_residences.sql` (person-place residences)
4. `20260424_rls_lockdown.sql` (P0-1 RLS lockdown: `app_users` allowlist + tightened policies)

See `SUPABASE_SETUP.md` for environment and auth provider configuration.

### 4. Run the tests

```bash
yarn test
```

### 5. Run the dev server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Homepage (landing + dashboard)
│   ├── family-tree/      # People list & management
│   ├── families/         # Family groups (list)
│   ├── family/[id]/      # Individual family view
│   ├── profile/[id]/     # Person profile & relationships
│   ├── events/           # Events list with inline edit
│   ├── memories/         # Memories with photo uploads
│   ├── places/           # Places map (Leaflet)
│   ├── timeline/         # Chronological timeline
│   ├── login/, signup/   # Authentication
│   ├── forgot-password/, reset-password/
│   ├── auth/callback/    # Supabase email verification callback
│   ├── admin/seed/       # Seed data management
│   └── api/              # API routes (seed, geocode, convert-image, webhooks)
├── components/           # Shared components (NavBar, GenealogyTree, PlacesMap, modals, etc.)
├── lib/
│   ├── supabase.ts       # Custom Supabase REST client
│   ├── db.ts             # Data access layer (CRUD operations)
│   ├── storage.ts        # Supabase Storage helpers (uploads)
│   ├── userPersonLink.tsx
│   └── emails/           # Resend transactional email senders
├── models/               # TypeScript interfaces (Person, Family, Event, Memory, ...)
├── utils/                # Pure helpers (dates, gedcom, heic, colors, treeBuilder, ...)
├── constants/            # Shared constants
└── __tests__/            # Vitest tests
```

## Seed Data

For demo purposes, you can populate the app with sample data (3 generations, 16 people, 3 families, 10 events, 5 memories):

1. Navigate to `/admin/seed`
2. Click **Seed Database** to add sample data
3. Click **Remove Seed Data** to clean it up

> Requires `SUPABASE_SERVICE_ROLE_KEY` in your environment.

## Deployment

The easiest way to deploy is with [Vercel](https://vercel.com):

1. Push your repo to GitHub
2. Import the project in Vercel
3. Add your environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
4. Deploy

After deploying, update your Supabase project:
- **Auth > URL Configuration** — add your production URL to Site URL and Redirect URLs
- **Storage** — add your production domain to CORS allowed origins if photo uploads fail

## License

Private project.
