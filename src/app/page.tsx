"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import { listPeople, listMemories, listEvents } from "@/lib/db"
import type { Person } from "@/models/Person"
import type { Memory } from "@/models/Memory"
import type { Event } from "@/models/Event"
import Link from "next/link"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { MemoryImage } from "@/components/MemoryImage"
import { formatDate, getAge, getNextBirthday } from "@/utils/dates"
import { SkeletonCard, SkeletonLine } from "@/components/SkeletonLoader"
import WelcomeModal from "@/components/WelcomeModal"
import { EVENT_TYPE_TAG_COLOR } from "@/constants/enums"

export default function Home() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [myPerson, setMyPerson] = useState<Person | null>(null)

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

        // Find current user's person record
        const me = p.find((person) => person.userId === user.id)
        if (me) setMyPerson(me)
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
      <div className="min-h-screen">
        {/* Hero */}
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-4 leading-tight">
            <span className="warm-gradient">Your Family&apos;s Story,</span><br />
            <span className="text-white">All in One Place</span>
          </h1>
          <p className="text-gray-300 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
            Preserve memories, connect generations, and celebrate the moments that make your family unique.
          </p>
          <div className="flex gap-4">
            <Link
              href="/signup"
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-8 py-3.5 rounded-xl text-lg font-medium min-h-[48px] transition"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="bg-[var(--card-bg)] hover:bg-[var(--card-hover)] border border-[var(--card-border)] text-white px-8 py-3.5 rounded-xl text-lg font-medium min-h-[48px] transition"
            >
              Log In
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 text-center card-shadow hover:border-[var(--accent)]/30 transition">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Build Your Tree</h3>
              <p className="text-gray-400 text-base leading-relaxed">
                Connect parents, children, and spouses across generations.
              </p>
            </div>
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 text-center card-shadow hover:border-[var(--accent)]/30 transition">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Share Memories</h3>
              <p className="text-gray-400 text-base leading-relaxed">
                Photos, stories, and the moments that matter most.
              </p>
            </div>
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 text-center card-shadow hover:border-[var(--accent)]/30 transition">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Celebrate Together</h3>
              <p className="text-gray-400 text-base leading-relaxed">
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
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <SkeletonLine className="w-64 h-8 mb-2" />
        <SkeletonLine className="w-40 h-4 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  // Upcoming birthdays (within 31 days)
  const upcomingBirthdays = people
    .filter((p) => p.birthDate && !p.deathDate)
    .map((p) => ({ person: p, ...getNextBirthday(p.birthDate!) }))
    .filter((b) => b.daysUntil <= 31)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

  const recentMemories = memories.slice(0, 4)
  const recentEvents = events.slice(0, 3)

  const greeting = myPerson?.firstName
    ? myPerson.firstName
    : user.email
      ? user.email.split("@")[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "there"
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  // Getting Started checklist (for new users)
  const isNewUser = people.length <= 5
  const familyTreeHref = myPerson?.familyIds?.[0] ? `/family/${myPerson.familyIds[0]}` : "/families"
  const gettingStarted = myPerson
    ? [
        { label: "Add your basic info", done: !!(myPerson.birthDate && myPerson.firstName && myPerson.lastName), href: `/profile/${myPerson.id}?edit=true` },
        { label: "Add a profile photo", done: !!myPerson.profilePhotoUrl, href: `/profile/${myPerson.id}?edit=true` },
        { label: "Add your parents", done: (myPerson.parentIds?.length ?? 0) > 0, href: `/profile/${myPerson.id}?edit=true` },
        { label: "Add a family member", done: people.length > 1, href: "/family-tree" },
        { label: "Share your first memory", done: memories.length > 0, href: "/memories" },
        { label: "Invite a family member", done: people.some((p) => p.userId && p.userId !== user.id), href: familyTreeHref },
      ]
    : []
  const completedSteps = gettingStarted.filter((s) => s.done).length

  // Completeness nudges for the current user's own profile only
  const nudges: { message: string; href: string }[] = []
  if (!isNewUser && myPerson) {
    const profileHref = `/profile/${myPerson.id}?edit=true`
    if (!myPerson.birthDate) {
      nudges.push({ message: "You have no birth date", href: profileHref })
    }
    if (!myPerson.profilePhotoUrl) {
      nudges.push({ message: "You have no profile photo", href: profileHref })
    }
    if ((myPerson.parentIds?.length ?? 0) === 0) {
      nudges.push({ message: "You have no parents listed", href: profileHref })
    }
  }

  // Whether birthdays or events sidebar has content
  const hasSidebarContent = upcomingBirthdays.length > 0 || recentEvents.length > 0

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <WelcomeModal />

      {/* ── Greeting + Stats ── */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {greeting}
        </h1>
        <p className="text-gray-400 text-base mt-1">{today}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
          <span>{people.length} family member{people.length !== 1 ? "s" : ""}</span>
          <span className="text-gray-600">&middot;</span>
          <span>{memories.length} memor{memories.length !== 1 ? "ies" : "y"}</span>
          <span className="text-gray-600">&middot;</span>
          <span>{events.length} event{events.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* ── Hero Action: Family Tree ── */}
      <section>
        <Link
          href={familyTreeHref}
          className="block bg-gradient-to-r from-[var(--accent)]/20 to-transparent border border-[var(--accent)]/20 rounded-xl p-6 hover:from-[var(--accent)]/30 transition group"
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-white">Your Family Tree</p>
              <p className="text-gray-300 text-base mt-0.5">View and build your family connections</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-[var(--accent)] transition flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </Link>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <Link
            href="/family-tree"
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 text-center hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/30 transition card-shadow"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-2">
              <svg className="w-4.5 h-4.5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <p className="text-white text-sm font-medium">Add a Person</p>
          </Link>
          <Link
            href="/memories"
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 text-center hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/30 transition card-shadow"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-2">
              <svg className="w-4.5 h-4.5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-white text-sm font-medium">Share a Memory</p>
          </Link>
          <Link
            href="/timeline"
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 text-center hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/30 transition card-shadow"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-2">
              <svg className="w-4.5 h-4.5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-white text-sm font-medium">Browse Timeline</p>
          </Link>
          <InviteFamilyButton familyId={myPerson?.familyIds?.[0]} />
        </div>
      </section>

      {/* ── Getting Started (new users) ── */}
      {isNewUser && myPerson && completedSteps < gettingStarted.length && (
        <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 card-shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Getting Started</h2>
            <span className="text-sm text-gray-400">{completedSteps}/{gettingStarted.length} complete</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 mb-5">
            <div
              className="bg-[var(--accent)] h-2 rounded-full transition-all"
              style={{ width: `${(completedSteps / gettingStarted.length) * 100}%` }}
            />
          </div>
          <ul className="space-y-2">
            {gettingStarted.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={`flex items-center gap-3 p-3 rounded-lg transition ${
                    step.done
                      ? "bg-gray-800/50 text-gray-500"
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    step.done
                      ? "border-green-500 bg-green-500/20 text-green-400"
                      : "border-gray-600"
                  }`}>
                    {step.done && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${step.done ? "line-through" : "font-medium"}`}>{step.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Nudges (active users) ── */}
      {nudges.length > 0 && !isNewUser && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Suggested Actions</h2>
          <div className="space-y-2">
            {nudges.slice(0, 3).map((nudge) => (
              <Link
                key={nudge.message}
                href={nudge.href}
                className="flex items-center gap-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/30 transition card-shadow"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
                <span className="text-gray-200 text-sm flex-1">{nudge.message}</span>
                <span className="text-[var(--accent)] text-sm font-medium flex-shrink-0">Fix</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Two-Column Content Area ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Recent Memories */}
        <section className={hasSidebarContent ? "lg:col-span-3" : "lg:col-span-5"}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-white">Recent Memories</h2>
            {memories.length > 0 && (
              <Link href="/memories" className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm">
                View all
              </Link>
            )}
          </div>
          {recentMemories.length === 0 ? (
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-8 text-center card-shadow">
              <p className="text-gray-300 text-sm mb-4">
                No memories yet — share your first family story!
              </p>
              <Link
                href="/memories"
                className="inline-block bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition"
              >
                Share a Memory
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentMemories.map((m) => (
                <Link
                  key={m.id}
                  href="/memories"
                  className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden hover:bg-[var(--card-hover)] transition card-shadow"
                >
                  <MemoryImage
                    src={m.imageUrls?.[0]}
                    alt={m.title}
                    className="w-full h-32 object-cover"
                    fallback={
                      <div className="w-full h-32 bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
                        No photo
                      </div>
                    }
                  />
                  <div className="p-3">
                    <p className="text-white text-sm font-medium truncate">{m.title}</p>
                    <p className="text-gray-400 text-xs mt-1">{formatDate(m.date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Right: What's Happening sidebar */}
        {hasSidebarContent && (
          <aside className="lg:col-span-2">
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-5 space-y-5">
              <h2 className="text-lg font-semibold text-white">What&apos;s Happening</h2>

              {/* Birthdays */}
              {upcomingBirthdays.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Upcoming Birthdays</h3>
                  <div className="space-y-3">
                    {upcomingBirthdays.map(({ person, date, daysUntil }) => (
                      <Link
                        key={person.id}
                        href={`/profile/${person.id}`}
                        className="flex items-center gap-3 hover:bg-gray-800/50 rounded-lg p-1.5 -mx-1.5 transition"
                      >
                        <ProfileAvatar
                          src={person.profilePhotoUrl}
                          alt={`${person.firstName} ${person.lastName}`}
                          fallbackLetters={person.firstName + person.lastName}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="text-gray-400 text-xs">
                            Turns {getAge(person.birthDate!) + (daysUntil === 0 ? 0 : 1)} on{" "}
                            {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold flex-shrink-0 ${
                            daysUntil === 0
                              ? "text-yellow-400"
                              : daysUntil <= 7
                                ? "text-green-400"
                                : "text-gray-400"
                          }`}
                        >
                          {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Events */}
              {recentEvents.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent Events</h3>
                    <Link href="/events" className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-xs">
                      View all
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {recentEvents.map((e) => (
                      <Link
                        key={e.id}
                        href="/events"
                        className="flex items-center gap-3 hover:bg-gray-800/50 rounded-lg p-1.5 -mx-1.5 transition"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_TYPE_TAG_COLOR[e.type]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{e.title}</p>
                          <p className="text-gray-400 text-xs">{formatDate(e.date)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

/** Invite Family quick action button with clipboard feedback */
function InviteFamilyButton({ familyId }: { familyId?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!familyId) return
    const url = `${window.location.origin}/signup?family=${familyId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [familyId])

  if (!familyId) {
    return (
      <Link
        href="/families"
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 text-center hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/30 transition card-shadow"
      >
        <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-2">
          <svg className="w-4.5 h-4.5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </div>
        <p className="text-white text-sm font-medium">Invite Family</p>
      </Link>
    )
  }

  return (
    <button
      onClick={handleCopy}
      className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 text-center hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/30 transition card-shadow"
    >
      <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-2">
        <svg className="w-4.5 h-4.5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
      </div>
      <p className="text-white text-sm font-medium">{copied ? "Link Copied!" : "Invite Family"}</p>
    </button>
  )
}
