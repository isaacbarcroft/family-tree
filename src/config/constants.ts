/**
 * Shared UI and service constants.
 *
 * Pulled out of individual pages so that page-size, rate-limit, and layout
 * choices live in one reviewable place. Keeping them typed (`as const`)
 * prevents accidental mutation at use sites.
 */

/**
 * Page size for paginated list views. Gallery-style grids use a multiple of
 * the common column counts (2/3/4) so the last row is visually balanced; list
 * views don't care and use 25.
 */
export const PAGE_SIZE = {
  FAMILIES: 24,
  MEMORIES: 24,
  EVENTS: 25,
  PEOPLE: 25,
} as const

/**
 * How many items of each kind the signed-in home page surfaces under
 * "recent" / "upcoming" headers.
 */
export const HOME_RECENT = {
  UPCOMING_BIRTHDAYS: 5,
  MEMORIES: 4,
  EVENTS: 3,
  NUDGES: 3,
} as const

/**
 * Minimum delay between outbound Nominatim geocoding requests, per
 * https://operations.osmfoundation.org/policies/nominatim/ — 1 request/second.
 * We give ourselves a 100ms buffer to stay safely under the cap.
 */
export const NOMINATIM_MIN_MS_BETWEEN_CALLS = 1100

/**
 * Height of the Leaflet map viewport and its matching skeleton. Tuned to
 * leave the page header + legend visible above the fold on a laptop.
 */
export const PLACES_MAP_HEIGHT = "70vh"

/**
 * Height of the D3 genealogy-tree viewport and the dynamic-import skeleton
 * that holds its space until the chunk lands. Kept identical to the SVG
 * container so swapping the placeholder in for the real tree doesn't shift
 * the page.
 */
export const GENEALOGY_TREE_HEIGHT = "85vh"

/**
 * DOM id of the top-level <main> landmark in the root layout. Used by
 * RouteFocusManager to move focus after client-side navigation so keyboard
 * and screen-reader users land at the start of the new page's content
 * instead of staying on the now-replaced node (or losing focus entirely).
 */
export const MAIN_LANDMARK_ID = "main-content"
