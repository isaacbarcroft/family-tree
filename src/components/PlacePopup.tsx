"use client"

import Link from "next/link"
import type { PlacePin, LivedEntry } from "./PlacesMap"

function formatYear(date: string | null): string | null {
  if (!date) return null
  const year = date.slice(0, 4)
  return /^\d{4}$/.test(year) ? year : null
}

function livedRangeText(entry: LivedEntry): string | null {
  const from = formatYear(entry.dateFrom)
  const to = formatYear(entry.dateTo)
  if (from && to) return `${from}–${to}`
  if (from) return `from ${from}`
  if (to) return `until ${to}`
  return null
}

export default function PlacePopup({ pin }: { pin: PlacePin }) {
  const label = pin.displayName ?? pin.placeKey
  return (
    <div className="min-w-[180px] max-w-[280px] text-gray-900">
      <p className="text-sm font-semibold mb-2 leading-snug">{label}</p>

      {pin.birthPeople.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 mb-1">
            Born here
          </p>
          <ul className="space-y-0.5">
            {pin.birthPeople.map((p) => (
              <li key={`b-${p.id}`}>
                <Link
                  href={`/profile/${p.id}`}
                  className="text-sm text-teal-700 hover:underline"
                >
                  {p.firstName} {p.lastName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pin.livedEntries.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">
            Lived here
          </p>
          <ul className="space-y-0.5">
            {pin.livedEntries.map((entry, idx) => {
              const range = livedRangeText(entry)
              return (
                <li key={`l-${entry.person.id}-${idx}`} className="text-sm">
                  <Link
                    href={`/profile/${entry.person.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {entry.person.firstName} {entry.person.lastName}
                  </Link>
                  {entry.label && <span className="text-gray-600"> · {entry.label}</span>}
                  {range && <span className="text-gray-500"> · {range}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {pin.deathPeople.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
            Died here
          </p>
          <ul className="space-y-0.5">
            {pin.deathPeople.map((p) => (
              <li key={`d-${p.id}`}>
                <Link
                  href={`/profile/${p.id}`}
                  className="text-sm text-amber-700 hover:underline"
                >
                  {p.firstName} {p.lastName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
