import { NextResponse } from "next/server"
import { normalizePlace } from "@/models/GeocodedPlace"
import type { GeocodedPlace, GeocodedPlaceStatus } from "@/models/GeocodedPlace"

export const runtime = "nodejs"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const NOMINATIM_USER_AGENT = "FamilyLegacy/0.1 (contact: isaacbarcroft@gmail.com)"
const MIN_MS_BETWEEN_CALLS = 1100

// Chain concurrent calls on a single promise so each waiter is serialized
// behind the previous one. This keeps the 1 req/sec spacing correct even
// when multiple requests arrive at once within the same Node instance.
// Under horizontal scaling a shared limiter (Redis, queue, etc.) would be
// required to stay strictly within Nominatim's policy.
let ratePromise: Promise<number> = Promise.resolve(0)

function waitForRateLimit(): Promise<void> {
  const next = ratePromise.then(async (last) => {
    const wait = Math.max(0, MIN_MS_BETWEEN_CALLS - (Date.now() - last))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    return Date.now()
  })
  ratePromise = next
  return next.then(() => undefined)
}

async function verifyUser(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? ""
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${match[1]}` },
    })
    return res.ok
  } catch {
    return false
  }
}

// PostgREST `in.(...)` filter: wrap each value in double quotes and escape
// internal backslashes and quotes. placeKey comes from free-form user input,
// so an unescaped `"` would break the filter syntax.
function pgInValue(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

async function supabaseRest<T = unknown>(
  table: string,
  method: "GET" | "POST" | "PATCH",
  options: { body?: unknown; params?: string; prefer?: string } = {}
): Promise<T> {
  const url = `${supabaseUrl}/rest/v1/${table}${options.params ? `?${options.params}` : ""}`
  const headers: Record<string, string> = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    "Content-Type": "application/json",
  }
  if (options.prefer) headers.Prefer = options.prefer

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${method} ${table} failed: ${res.status} ${err}`)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

async function geocodeOne(raw: string): Promise<{
  status: GeocodedPlaceStatus
  latitude: number | null
  longitude: number | null
  displayName: string | null
  failureReason: string | null
}> {
  await waitForRateLimit()

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(raw)}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT, Accept: "application/json" },
    })
  } catch {
    return { status: "failed", latitude: null, longitude: null, displayName: null, failureReason: "network_error" }
  }

  if (!res.ok) {
    return { status: "failed", latitude: null, longitude: null, displayName: null, failureReason: `http_${res.status}` }
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    return { status: "failed", latitude: null, longitude: null, displayName: null, failureReason: "parse_error" }
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return { status: "failed", latitude: null, longitude: null, displayName: null, failureReason: "no_match" }
  }

  const first = payload[0] as Partial<NominatimResult>
  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { status: "failed", latitude: null, longitude: null, displayName: null, failureReason: "parse_error" }
  }

  return {
    status: "ok",
    latitude: lat,
    longitude: lon,
    displayName: first.display_name ?? null,
    failureReason: null,
  }
}

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 })
  }

  if (!(await verifyUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { places?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.places)) {
    return NextResponse.json({ error: "Expected { places: string[] }" }, { status: 400 })
  }

  const rawPlaces = body.places.filter((p): p is string => typeof p === "string" && p.trim().length > 0)

  // Dedup by normalized key while preserving first raw spelling seen
  const keyed = new Map<string, string>()
  for (const raw of rawPlaces) {
    const key = normalizePlace(raw)
    if (!keyed.has(key)) keyed.set(key, raw)
  }

  if (keyed.size === 0) {
    return NextResponse.json({ results: [] })
  }

  // Load existing rows in one call so we can skip anything already ok/failed
  const lookupParams = new URLSearchParams()
  lookupParams.set("placeKey", `in.(${[...keyed.keys()].map(pgInValue).join(",")})`)
  const existing = await supabaseRest<GeocodedPlace[]>("geocoded_places", "GET", {
    params: lookupParams.toString(),
  })
  const existingByKey = new Map<string, GeocodedPlace>()
  for (const row of existing ?? []) existingByKey.set(row.placeKey, row)

  const results: Array<{
    placeKey: string
    status: GeocodedPlaceStatus
    latitude: number | null
    longitude: number | null
    displayName: string | null
  }> = []

  for (const [placeKey, rawPlace] of keyed) {
    const cached = existingByKey.get(placeKey)
    if (cached && (cached.status === "ok" || cached.status === "failed")) {
      results.push({
        placeKey,
        status: cached.status,
        latitude: cached.latitude,
        longitude: cached.longitude,
        displayName: cached.displayName ?? null,
      })
      continue
    }

    const geo = await geocodeOne(rawPlace)
    const now = new Date().toISOString()
    const row = {
      placeKey,
      rawPlace,
      latitude: geo.latitude,
      longitude: geo.longitude,
      displayName: geo.displayName,
      status: geo.status,
      failureReason: geo.failureReason,
      geocodedAt: now,
      updatedAt: now,
    }

    await supabaseRest("geocoded_places", "POST", {
      body: row,
      params: "on_conflict=placeKey",
      prefer: "resolution=merge-duplicates,return=minimal",
    })

    results.push({
      placeKey,
      status: geo.status,
      latitude: geo.latitude,
      longitude: geo.longitude,
      displayName: geo.displayName,
    })
  }

  return NextResponse.json({ results })
}
