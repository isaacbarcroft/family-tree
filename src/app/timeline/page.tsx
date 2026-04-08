"use client"

import { useEffect, useState } from "react"
import { listEvents, listMemories, listPeople } from "@/lib/db"
import type { Event } from "@/models/Event"
import type { Memory } from "@/models/Memory"
import type { Person } from "@/models/Person"
import ProtectedRoute from "@/components/ProtectedRoute"
import { formatDate } from "@/utils/dates"
import Link from "next/link"

interface TimelineItem {
  id: string
  title: string
  date: string
  type: "event" | "memory"
  description?: string
  imageUrl?: string
  peopleIds: string[]
  eventType?: string
}

export default function TimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [filtered, setFiltered] = useState<TimelineItem[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [peopleMap, setPeopleMap] = useState<Map<string, Person>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<"all" | "event" | "memory">("all")
  const [filterPerson, setFilterPerson] = useState("")

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [events, memories, allPeople] = await Promise.all([
          listEvents(),
          listMemories(),
          listPeople(),
        ])

        const map = new Map<string, Person>()
        for (const p of allPeople) map.set(p.id, p)
        setPeopleMap(map)
        setPeople(allPeople)

        const eventItems: TimelineItem[] = events.map((e: Event) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          type: "event" as const,
          description: e.description,
          peopleIds: e.peopleIds,
          eventType: e.type,
        }))

        const memoryItems: TimelineItem[] = memories.map((m: Memory) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          type: "memory" as const,
          description: m.description,
          imageUrl: m.imageUrls?.[0],
          peopleIds: m.peopleIds,
        }))

        const all = [...eventItems, ...memoryItems].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setItems(all)
        setFiltered(all)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  useEffect(() => {
    let result = items
    if (filterType !== "all") {
      result = result.filter((i) => i.type === filterType)
    }
    if (filterPerson) {
      result = result.filter((i) => i.peopleIds.includes(filterPerson))
    }
    setFiltered(result)
  }, [filterType, filterPerson, items])

  if (loading)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-400 text-lg">Loading timeline...</div>
      </ProtectedRoute>
    )

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-xl shadow-lg">
        <h1 className="text-4xl font-bold text-white mb-6">Timeline</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2">
            {(["all", "event", "memory"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-2 rounded-lg text-base font-medium min-h-[44px] ${
                  filterType === t
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {t === "all" ? "All" : t === "event" ? "Events" : "Memories"}
              </button>
            ))}
          </div>
          <select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 rounded-lg text-base"
          >
            <option value="">All People</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No items found.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

            <div className="space-y-6">
              {filtered.map((item) => (
                <div key={`${item.type}-${item.id}`} className="relative pl-10">
                  {/* Dot */}
                  <div
                    className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 border-gray-900 ${
                      item.type === "memory" ? "bg-purple-500" : "bg-green-500"
                    }`}
                  />

                  <div className="border border-gray-700 bg-gray-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      {/* Memory thumbnail */}
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-16 h-16 object-cover rounded flex-shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-sm px-2 py-0.5 rounded ${
                              item.type === "memory"
                                ? "bg-purple-600 text-white"
                                : "bg-green-600 text-white"
                            }`}
                          >
                            {item.type === "memory" ? "Memory" : item.eventType || "Event"}
                          </span>
                          <span className="text-sm text-gray-300">
                            {formatDate(item.date)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        {item.description && (
                          <p className="text-gray-300 text-base mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {item.peopleIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.peopleIds.slice(0, 5).map((pid) => {
                              const person = peopleMap.get(pid)
                              return person ? (
                                <Link
                                  key={pid}
                                  href={`/profile/${pid}`}
                                  className="text-blue-400 hover:text-blue-300 text-sm"
                                >
                                  {person.firstName}
                                </Link>
                              ) : null
                            })}
                            {item.peopleIds.length > 5 && (
                              <span className="text-sm text-gray-300">
                                +{item.peopleIds.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
