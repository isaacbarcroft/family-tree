"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import { listPeople, listMemories, listEvents } from "@/lib/db"
import type { Person } from "@/models/Person"
import type { Memory } from "@/models/Memory"
import type { Event } from "@/models/Event"
import Link from "next/link"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { formatDate } from "@/utils/dates"
import { supabase } from "@/lib/supabase"

/** Parse a date string as local time (avoids UTC timezone shift for "YYYY-MM-DD" strings) */
function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(dateStr)
}

function getNextBirthday(birthDate: string): { date: Date; daysUntil: number } {
  const today = new Date()
  const birth = parseLocalDate(birthDate)
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return { date: next, daysUntil: diff }
}

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = parseLocalDate(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const typeColors: Record<string, string> = {
  life: "bg-green-600",
  memory: "bg-purple-600",
  historical: "bg-amber-600",
}

export default function Home() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [familyCount, setFamilyCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const fetchAll = async () => {
      try {
        const [p, m, e] = await Promise.all([listPeople(), listMemories(), listEvents()])
        setPeople(p)
        setMemories(m.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
        setEvents(e.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))

        const { data: families } = await supabase.from("families").select("id")
        setFamilyCount(Array.isArray(families) ? families.length : 0)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [user])

  // Not logged in - show landing
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950">
        {/* Hero */}
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 leading-tight">
            Your Family&apos;s Story,<br />All in One Place
          </h1>
          <p className="text-gray-300 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
            Preserve memories, connect generations, and celebrate the moments that make your family unique.
          </p>
          <div className="flex gap-4">
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl text-lg font-medium min-h-[48px] transition"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 py-3.5 rounded-xl text-lg font-medium min-h-[48px] transition"
            >
              Log In
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">🌳</div>
              <h3 className="text-xl font-semibold text-white mb-2">Build Your Tree</h3>
              <p className="text-gray-300 text-base leading-relaxed">
                Connect parents, children, and spouses across generations.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">📸</div>
              <h3 className="text-xl font-semibold text-white mb-2">Share Memories</h3>
              <p className="text-gray-300 text-base leading-relaxed">
                Photos, stories, and the moments that matter most.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">🎂</div>
              <h3 className="text-xl font-semibold text-white mb-2">Celebrate Together</h3>
              <p className="text-gray-300 text-base leading-relaxed">
                Birthdays, milestones, and family events — never miss a moment.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 text-lg">Loading dashboard...</div>
    )
  }

  // Upcoming birthdays
  const upcomingBirthdays = people
    .filter((p) => p.birthDate && !p.deathDate)
    .map((p) => ({ person: p, ...getNextBirthday(p.birthDate!) }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

  const recentMemories = memories.slice(0, 4)
  const recentEvents = events.slice(0, 3)

  const greeting = user.email ? user.email.split("@")[0] : "there"
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Personalized Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {greeting}
        </h1>
        <p className="text-gray-300 text-base mt-1">{today}</p>
      </div>

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Upcoming Birthdays</h2>
          <div className="space-y-3">
            {upcomingBirthdays.map(({ person, date, daysUntil }) => (
              <Link
                key={person.id}
                href={`/profile/${person.id}`}
                className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl p-4 hover:bg-gray-700 hover:border-gray-600 transition"
              >
                <ProfileAvatar
                  src={person.profilePhotoUrl}
                  alt={`${person.firstName} ${person.lastName}`}
                  fallbackLetters={person.firstName + person.lastName}
                  size="sm"
                />
                <div className="flex-1">
                  <p className="text-white font-medium text-base">
                    {person.firstName} {person.lastName}
                  </p>
                  <p className="text-gray-300 text-base">
                    Turns {getAge(person.birthDate!) + (daysUntil === 0 ? 0 : 1)} on{" "}
                    {date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                  </p>
                </div>
                <span
                  className={`text-base font-semibold ${
                    daysUntil === 0
                      ? "text-yellow-400"
                      : daysUntil <= 7
                        ? "text-green-400"
                        : "text-gray-300"
                  }`}
                >
                  {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "People", value: people.length, href: "/family-tree" },
          { label: "Families", value: familyCount, href: "/families" },
          { label: "Memories", value: memories.length, href: "/memories" },
          { label: "Events", value: events.length, href: "/events" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center hover:bg-gray-700 hover:border-gray-600 transition"
          >
            <p className="text-4xl font-bold text-white">{stat.value}</p>
            <p className="text-gray-300 text-base mt-1">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent Memories */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold text-white">Recent Memories</h2>
          {memories.length > 0 && (
            <Link href="/memories" className="text-blue-400 hover:text-blue-300 text-base">
              View all
            </Link>
          )}
        </div>
        {recentMemories.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
            <p className="text-gray-300 text-base mb-4">
              No memories yet — share your first family story!
            </p>
            <Link
              href="/memories"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
            >
              Share a Memory
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentMemories.map((m) => (
              <Link
                key={m.id}
                href="/memories"
                className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:bg-gray-700 hover:border-gray-600 transition"
              >
                {m.imageUrls && m.imageUrls.length > 0 ? (
                  <img src={m.imageUrls[0]} alt={m.title} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-gray-700 flex items-center justify-center text-gray-400 text-base">
                    No photo
                  </div>
                )}
                <div className="p-4">
                  <p className="text-white text-base font-medium truncate">{m.title}</p>
                  <p className="text-gray-300 text-sm mt-1">{formatDate(m.date)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Events */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold text-white">Recent Events</h2>
          {events.length > 0 && (
            <Link href="/events" className="text-blue-400 hover:text-blue-300 text-base">
              View all
            </Link>
          )}
        </div>
        {recentEvents.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
            <p className="text-gray-300 text-base mb-4">
              No events yet — record your family&apos;s milestones!
            </p>
            <Link
              href="/events"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
            >
              Add an Event
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((e) => (
              <Link
                key={e.id}
                href="/events"
                className="flex items-center gap-4 bg-gray-800 border border-gray-700 rounded-xl p-4 hover:bg-gray-700 hover:border-gray-600 transition"
              >
                <div className="text-gray-300 text-sm font-medium w-24 flex-shrink-0">
                  {formatDate(e.date)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-medium truncate">{e.title}</p>
                </div>
                <span
                  className={`text-sm px-2.5 py-0.5 rounded-full text-white flex-shrink-0 ${typeColors[e.type] || "bg-gray-600"}`}
                >
                  {e.type}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Add a Person", href: "/family-tree", icon: "👤" },
            { label: "Share a Memory", href: "/memories", icon: "📸" },
            { label: "View People", href: "/family-tree", icon: "🌳" },
            { label: "Browse Timeline", href: "/timeline", icon: "📅" },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center hover:bg-gray-700 hover:border-gray-600 transition"
            >
              <p className="text-3xl mb-2">{action.icon}</p>
              <p className="text-white text-base font-medium">{action.label}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
