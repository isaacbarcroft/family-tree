// Centralized configuration values that were previously sprinkled across pages
// and API routes. Grouped by surface area so the impact of a change is obvious.

// ── Paginated list pages ────────────────────────────────────────────────────
// Page size used by the cursor-style "Load More" pagination. Memory and family
// pages render a card grid (4 across), so they use a multiple of 4 to keep the
// last row tidy; events and people render single-column lists.
export const PEOPLE_PAGE_SIZE = 25
export const EVENTS_PAGE_SIZE = 25
export const MEMORIES_PAGE_SIZE = 24
export const FAMILIES_PAGE_SIZE = 24

// ── Home page (`src/app/page.tsx`) ──────────────────────────────────────────
// "Recent" preview counts on the dashboard.
export const HOME_RECENT_MEMORIES = 4
export const HOME_RECENT_EVENTS = 3
// Upcoming birthdays panel: at most N people, anyone within W days from today.
export const HOME_UPCOMING_BIRTHDAYS = 5
export const HOME_UPCOMING_BIRTHDAY_WINDOW_DAYS = 31
// Suggested-action nudges shown to active (non-new) users.
export const HOME_MAX_NUDGES = 3
// "New user" threshold drives the Getting Started checklist.
export const NEW_USER_PEOPLE_THRESHOLD = 5

// ── Places page (`src/app/places/page.tsx`) ─────────────────────────────────
// Map viewport height. Used both for the live map and for the matching loading
// skeleton so the layout doesn't jump when the dynamic import resolves.
export const PLACES_MAP_HEIGHT = "70vh"

// ── Geocode API route (`src/app/api/geocode/route.ts`) ──────────────────────
// Minimum spacing between Nominatim calls. Their usage policy asks for at most
// 1 request per second; we pad slightly to absorb clock skew and network jitter.
// Reference: https://operations.osmfoundation.org/policies/nominatim/
export const GEOCODE_MIN_MS_BETWEEN_CALLS = 1100
