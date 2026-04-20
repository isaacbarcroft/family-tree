export type GeocodedPlaceStatus = "pending" | "ok" | "failed" | "ambiguous"

export interface GeocodedPlace {
  id: string
  placeKey: string
  rawPlace: string
  latitude: number | null
  longitude: number | null
  displayName?: string | null
  status: GeocodedPlaceStatus
  failureReason?: string | null
  geocodedAt?: string | null
  createdAt: string
  updatedAt?: string | null
}

export function normalizePlace(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}
