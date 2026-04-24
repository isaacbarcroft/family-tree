"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import ProtectedRoute from "@/components/ProtectedRoute"
import { SkeletonLine, SkeletonCard } from "@/components/SkeletonLoader"
import UngeocodedSidebar from "@/components/UngeocodedSidebar"
import {
  listGeocodedPlaces,
  listPeople,
  listResidences,
  requestGeocode,
} from "@/lib/db"
import { normalizePlace } from "@/models/GeocodedPlace"
import type { GeocodedPlace } from "@/models/GeocodedPlace"
import type { Person } from "@/models/Person"
import type { Residence } from "@/models/Residence"
import type { PlacePin } from "@/components/PlacesMap"
import { PLACES_MAP_HEIGHT } from "@/config/constants"

const PlacesMap = dynamic(() => import("@/components/PlacesMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl bg-gray-900/40 border border-[var(--card-border)] animate-pulse"
      style={{ height: PLACES_MAP_HEIGHT }}
    />
  ),
})

function findUnknownPlaces(
  people: Person[],
  residences: Residence[],
  rows: GeocodedPlace[]
): string[] {
  const known = new Set(rows.map((r) => r.placeKey))
  const seen = new Set<string>()
  const out: string[] = []

  const consider = (raw: string | null | undefined) => {
    if (!raw) return
    const key = normalizePlace(raw)
    if (!key || seen.has(key) || known.has(key)) return
    seen.add(key)
    out.push(raw)
  }

  for (const p of people) {
    consider(p.birthPlace)
    consider(p.deathPlace)
  }
  for (const r of residences) {
    consider(r.rawPlace)
  }
  return out
}

export default function PlacesPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [residences, setResidences] = useState<Residence[]>([])
  const [placeRows, setPlaceRows] = useState<GeocodedPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [geocoding, setGeocoding] = useState(false)

  const loadSnapshot = useCallback(async (isActive: () => boolean = () => true) => {
    const [allPeople, allResidences, rows] = await Promise.all([
      listPeople(),
      listResidences(),
      listGeocodedPlaces(),
    ])
    if (isActive()) {
      setPeople(allPeople)
      setResidences(allResidences)
      setPlaceRows(rows)
    }
    return { allPeople, allResidences, rows }
  }, [])

  const refresh = useCallback(
    async (isActive: () => boolean = () => true) => {
      const first = await loadSnapshot(isActive)
      const unknown = findUnknownPlaces(first.allPeople, first.allResidences, first.rows)
      if (unknown.length === 0) return

      if (isActive()) setGeocoding(true)
      try {
        await requestGeocode(unknown)
        await loadSnapshot(isActive)
      } finally {
        if (isActive()) setGeocoding(false)
      }
    },
    [loadSnapshot]
  )

  useEffect(() => {
    let cancelled = false
    const isActive = () => !cancelled
    const run = async () => {
      try {
        await refresh(isActive)
      } catch (err) {
        console.error("Failed to load places", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const pins: PlacePin[] = useMemo(() => {
    const byKey = new Map<string, PlacePin>()
    const rowByKey = new Map<string, GeocodedPlace>()
    for (const row of placeRows) rowByKey.set(row.placeKey, row)

    const personById = new Map<string, Person>()
    for (const p of people) personById.set(p.id, p)

    const ensurePin = (key: string, row: GeocodedPlace): PlacePin | null => {
      if (row.status !== "ok" || row.latitude == null || row.longitude == null) return null
      let pin = byKey.get(key)
      if (!pin) {
        pin = {
          placeKey: key,
          latitude: row.latitude,
          longitude: row.longitude,
          displayName: row.displayName ?? row.rawPlace,
          birthPeople: [],
          deathPeople: [],
          livedEntries: [],
        }
        byKey.set(key, pin)
      }
      return pin
    }

    for (const person of people) {
      if (person.birthPlace) {
        const key = normalizePlace(person.birthPlace)
        const row = rowByKey.get(key)
        if (row) {
          const pin = ensurePin(key, row)
          if (pin) pin.birthPeople.push(person)
        }
      }
      if (person.deathPlace) {
        const key = normalizePlace(person.deathPlace)
        const row = rowByKey.get(key)
        if (row) {
          const pin = ensurePin(key, row)
          if (pin) pin.deathPeople.push(person)
        }
      }
    }

    for (const r of residences) {
      const person = personById.get(r.personId)
      if (!person) continue
      const key = normalizePlace(r.rawPlace)
      const row = rowByKey.get(key)
      if (!row) continue
      const pin = ensurePin(key, row)
      if (!pin) continue
      pin.livedEntries.push({
        person,
        label: r.label ?? null,
        dateFrom: r.dateFrom ?? null,
        dateTo: r.dateTo ?? null,
      })
    }
    return [...byKey.values()]
  }, [people, residences, placeRows])

  const ungeocodedRows = useMemo(
    () => placeRows.filter((r) => r.status !== "ok"),
    [placeRows]
  )

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-4xl font-bold text-white">Places</h1>
            <p className="text-sm text-gray-400 mt-1">
              Where your family was born, lived, and passed on.
            </p>
          </div>
          {geocoding && (
            <p className="text-sm text-gray-400">Locating new places…</p>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <SkeletonLine className="w-full" />
            <div
              className="w-full rounded-xl bg-gray-900/40 border border-[var(--card-border)] animate-pulse"
              style={{ height: PLACES_MAP_HEIGHT }}
            />
            <SkeletonCard />
          </div>
        ) : pins.length === 0 && ungeocodedRows.length === 0 ? (
          <div className="border border-[var(--card-border)] bg-[var(--card-bg)] rounded-xl p-8 text-center space-y-2">
            <p className="text-gray-300">No places yet.</p>
            <p className="text-sm text-gray-500">
              Open a family member&apos;s profile, click Edit, and fill in a
              birthplace, place of passing, or a &ldquo;Place lived.&rdquo; They&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div>
              <PlacesMap pins={pins} />
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-teal-500 border-2 border-white" />
                  Born here
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                  Lived here
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-amber-500 border-2 border-white" />
                  Died here
                </span>
                <span className="ml-auto">
                  {pins.length} {pins.length === 1 ? "place" : "places"}
                </span>
              </div>
            </div>
            <UngeocodedSidebar
              rows={ungeocodedRows}
              people={people}
              residences={residences}
              onChange={refresh}
            />
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
