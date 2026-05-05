"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { listEvents, listMemories, listPeople } from "@/lib/db";
import type { Event } from "@/models/Event";
import type { Memory } from "@/models/Memory";
import type { Person } from "@/models/Person";
import WelcomeModal from "@/components/WelcomeModal";
import { SkeletonCard, SkeletonLine } from "@/components/SkeletonLoader";
import { Avatar, Button, Chip, Icon, PhotoFrame } from "@/components/ui";
import { formatDate, getAge, getNextBirthday } from "@/utils/dates";
import { toDisplayImageUrl } from "@/utils/imageUrl";
import { HOME_RECENT } from "@/config/constants";

export default function Home() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPerson, setMyPerson] = useState<Person | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchAll = async () => {
      try {
        const [p, m, e] = await Promise.all([listPeople(), listMemories(), listEvents()]);
        setPeople(p);
        setMemories(
          m.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        );
        setEvents(e.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        const me = p.find((person) => person.userId === user.id);
        if (me) setMyPerson(me);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  if (!user) return <LoggedOutLanding />;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-12 md:px-16">
        <SkeletonLine className="mb-2 h-10 w-72" />
        <SkeletonLine className="mb-6 h-4 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <HomeAuthenticated
      user={user}
      people={people}
      memories={memories}
      events={events}
      myPerson={myPerson}
    />
  );
}

// =============================================================================
// Logged-out landing — editorial hero + 3 feature cards
// =============================================================================
function LoggedOutLanding() {
  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <section
        className="px-6 pb-20 pt-20 md:px-16 md:pt-24"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow" style={{ marginBottom: 14 }}>
            A living family history
          </p>
          <h1
            className="display"
            style={{
              fontSize: "clamp(48px, 8vw, 84px)",
              margin: 0,
              fontWeight: 400,
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
            }}
          >
            Your family&rsquo;s story,{" "}
            <span className="display-italic" style={{ color: "var(--sage-deep)" }}>
              kept together
            </span>
            .
          </h1>
          <p
            className="mt-7"
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              color: "var(--ink-2)",
              maxWidth: 560,
              margin: "28px auto 0",
            }}
          >
            Preserve memories, connect generations, and celebrate the moments that make your family
            who they are.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/signup" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="lg">
                Get started
              </Button>
            </Link>
            <Link href="/login" style={{ textDecoration: "none" }}>
              <Button variant="ghost" size="lg">
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          <FeatureCard
            icon="people"
            title="Build your tree"
            body="Connect parents, children, and spouses across generations."
          />
          <FeatureCard
            icon="memory"
            title="Share memories"
            body="Photos, stories, and the moments that matter most."
          />
          <FeatureCard
            icon="cake"
            title="Celebrate together"
            body="Birthdays, milestones, and family events — never miss a moment."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: "people" | "memory" | "cake";
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-lg p-6 text-center"
      style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
    >
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "var(--sage-tint)", color: "var(--sage-deep)" }}
      >
        <Icon name={icon} size={20} />
      </div>
      <h3
        className="display m-0"
        style={{ fontSize: 22, fontWeight: 500, color: "var(--ink)" }}
      >
        {title}
      </h3>
      <p className="mt-2" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}>
        {body}
      </p>
    </div>
  );
}

// =============================================================================
// Authenticated home — editorial layout
// =============================================================================
type HomeProps = {
  user: { id: string; email?: string };
  people: Person[];
  memories: Memory[];
  events: Event[];
  myPerson: Person | null;
};

function HomeAuthenticated({ user, people, memories, events, myPerson }: HomeProps) {
  const upcomingBirthdays = people
    .filter((p) => p.birthDate && !p.deathDate)
    .map((p) => ({ person: p, ...getNextBirthday(p.birthDate!) }))
    .filter((b) => b.daysUntil <= 31)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, HOME_RECENT.UPCOMING_BIRTHDAYS);

  const featuredMemory = memories.find((m) => m.imageUrls && m.imageUrls.length > 0) ?? memories[0] ?? null;
  const recentMemories = memories.slice(0, HOME_RECENT.MEMORIES);

  const greeting = myPerson?.firstName
    ? myPerson.firstName
    : user.email
      ? user.email
          .split("@")[0]
          .split(/[._-]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "there";

  const today = new Date();
  const dateLine = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const placeLine = joinPlace(myPerson?.city, myPerson?.state);

  const isNewUser = people.length <= 5;
  const familyTreeHref = myPerson?.familyIds?.[0]
    ? `/families/${myPerson.familyIds[0]}`
    : "/families";

  const gettingStarted = myPerson
    ? [
        {
          label: "Add your basic info",
          done: Boolean(myPerson.birthDate && myPerson.firstName && myPerson.lastName),
          href: `/profile/${myPerson.id}?edit=true`,
        },
        {
          label: "Add a profile photo",
          done: Boolean(myPerson.profilePhotoUrl),
          href: `/profile/${myPerson.id}?edit=true`,
        },
        {
          label: "Add your parents",
          done: (myPerson.parentIds?.length ?? 0) > 0,
          href: `/profile/${myPerson.id}?edit=true`,
        },
        {
          label: "Add a family member",
          done: people.length > 1,
          href: "/family-tree",
        },
        {
          label: "Share your first memory",
          done: memories.length > 0,
          href: "/memories",
        },
        {
          label: "Invite a family member",
          done: people.some((p) => p.userId && p.userId !== user.id),
          href: familyTreeHref,
        },
      ]
    : [];
  const completedSteps = gettingStarted.filter((s) => s.done).length;
  const showGettingStarted = isNewUser && myPerson && completedSteps < gettingStarted.length;

  // Recently passed — most recent person with a deathDate
  const inMemory = people
    .filter((p) => p.deathDate)
    .sort((a, b) => (b.deathDate ?? "").localeCompare(a.deathDate ?? ""))[0];

  // Completeness nudges for the current user's own profile only
  const nudges: { message: string; href: string }[] = [];
  if (!isNewUser && myPerson) {
    const profileHref = `/profile/${myPerson.id}?edit=true`;
    if (!myPerson.birthDate) {
      nudges.push({ message: "You have no birth date", href: profileHref });
    }
    if (!myPerson.profilePhotoUrl) {
      nudges.push({ message: "You haven't added a photo yet", href: profileHref });
    }
    if ((myPerson.parentIds?.length ?? 0) === 0) {
      nudges.push({ message: "You have no parents listed", href: profileHref });
    }
  }

  return (
    <div
      className="mx-auto px-6 pb-16 pt-10 md:px-16 md:pt-12"
      style={{ background: "var(--paper)", color: "var(--ink)", maxWidth: 1280 }}
    >
      <WelcomeModal />

      {/* Dateline */}
      <div
        className="mb-8 flex items-baseline justify-between gap-4 pb-3.5"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <div className="eyebrow">
          {dateLine}
          {placeLine ? ` · ${placeLine}` : ""}
        </div>
        <div className="eyebrow">
          {people.length} {people.length === 1 ? "relative" : "relatives"} · {memories.length}{" "}
          {memories.length === 1 ? "memory" : "memories"}
        </div>
      </div>

      {/* Greeting */}
      <header className="mb-12">
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          Welcome back
        </p>
        <h1
          className="display"
          style={{
            fontSize: "clamp(48px, 7vw, 72px)",
            margin: 0,
            lineHeight: 0.98,
            maxWidth: 900,
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          {timeOfDayGreeting()},{" "}
          <span className="display-italic" style={{ color: "var(--sage-deep)" }}>
            {greeting}
          </span>
          .
        </h1>
        <p
          className="mt-6"
          style={{
            fontSize: 17,
            color: "var(--ink-2)",
            maxWidth: 560,
            lineHeight: 1.55,
          }}
        >
          {ledeText({
            birthdayCount: upcomingBirthdays.length,
            memoryCount: memories.length,
            eventCount: events.length,
          })}
        </p>
      </header>

      {/* Hero spread: featured memory + today */}
      <section className="mb-14 grid grid-cols-1 gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
        <FeaturedMemory memory={featuredMemory} />
        <TodayPanel
          birthdays={upcomingBirthdays}
          fallbackHref={familyTreeHref}
          familyTreeReady={Boolean(myPerson?.familyIds?.[0])}
        />
      </section>

      {/* Lower grid: in-memory, recent additions, your branch */}
      {(inMemory || recentMemories.length > 0 || (myPerson && people.length > 1)) ? (
        <section className="mb-14 grid grid-cols-1 gap-10 md:grid-cols-3">
          {inMemory ? <InMemoryColumn person={inMemory} /> : <div />}
          <RecentlyAddedColumn memories={recentMemories} />
          {myPerson ? <YourBranchColumn me={myPerson} people={people} /> : <div />}
        </section>
      ) : null}

      {/* Getting started — quiet card, only for new users */}
      {showGettingStarted ? (
        <section className="mb-14">
          <GettingStartedCard
            steps={gettingStarted}
            completedSteps={completedSteps}
          />
        </section>
      ) : null}

      {/* Suggested actions — gentle nudges for active users */}
      {nudges.length > 0 && !isNewUser ? (
        <section className="mb-14">
          <p className="eyebrow" style={{ marginBottom: 12 }}>
            Suggested actions
          </p>
          <div className="space-y-2">
            {nudges.slice(0, HOME_RECENT.NUDGES).map((nudge) => (
              <Link
                key={nudge.message}
                href={nudge.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--hairline)",
                  textDecoration: "none",
                  color: "var(--ink)",
                }}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: "var(--sage-deep)" }}
                />
                <span className="flex-1 text-sm" style={{ color: "var(--ink-2)" }}>
                  {nudge.message}
                </span>
                <span
                  className="flex-shrink-0 text-sm font-medium"
                  style={{ color: "var(--sage-deep)" }}
                >
                  Fix
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Quick actions */}
      <section
        className="flex flex-wrap gap-2.5 pt-7"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <Link href="/memories" style={{ textDecoration: "none" }}>
          <Button variant="primary" icon="photo">
            Share a memory
          </Button>
        </Link>
        <Link href="/family-tree" style={{ textDecoration: "none" }}>
          <Button variant="ghost" icon="plus">
            Add a person
          </Button>
        </Link>
        <Link href="/events" style={{ textDecoration: "none" }}>
          <Button variant="ghost" icon="event">
            Plan an event
          </Button>
        </Link>
        <InviteFamilyButton familyId={myPerson?.familyIds?.[0]} />
      </section>
    </div>
  );
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Welcome back";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ledeText(c: { birthdayCount: number; memoryCount: number; eventCount: number }): string {
  const bits: string[] = [];
  if (c.birthdayCount === 1) bits.push("one birthday this month");
  if (c.birthdayCount > 1) bits.push(`${c.birthdayCount} birthdays this month`);
  if (c.memoryCount > 0)
    bits.push(`${c.memoryCount} ${c.memoryCount === 1 ? "memory" : "memories"} on the page`);
  if (c.eventCount > 0)
    bits.push(`${c.eventCount} ${c.eventCount === 1 ? "event" : "events"} on the calendar`);
  if (bits.length === 0) return "Nothing on the page yet — start by adding a relative or a memory.";
  if (bits.length === 1) return `${capitalize(bits[0])}.`;
  if (bits.length === 2) return `${capitalize(bits[0])}, and ${bits[1]}.`;
  return `${capitalize(bits[0])}, ${bits.slice(1, -1).join(", ")}, and ${bits[bits.length - 1]}.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinPlace(...parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(", ");
}

// =============================================================================
// Featured memory — the editorial centerpiece on the home hero
// =============================================================================
function FeaturedMemory({ memory }: { memory: Memory | null }) {
  if (!memory) {
    return (
      <div>
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          The page
        </p>
        <div
          className="rounded-md p-12 text-center"
          style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
        >
          <p className="display-italic muted" style={{ fontSize: 22, margin: 0 }}>
            No memories yet — be the first to write one in.
          </p>
          <div className="mt-6">
            <Link href="/memories" style={{ textDecoration: "none" }}>
              <Button variant="primary" icon="photo">
                Share a memory
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const photoSrc = memory.imageUrls && memory.imageUrls[0] ? toDisplayImageUrl(memory.imageUrls[0]) : null;

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Featured memory
      </p>
      <Link href="/memories" style={{ textDecoration: "none", color: "inherit" }}>
        <PhotoFrame
          src={photoSrc}
          alt={memory.title}
          ratio="5 / 4"
          rounded={4}
          frame
          label={memory.title}
        />
        <div className="mt-5">
          <h3 className="display m-0" style={{ fontSize: 28, fontWeight: 500, color: "var(--ink)" }}>
            {memory.title}
          </h3>
          <p className="muted mt-1.5" style={{ fontSize: 13 }}>
            {memory.date ? <>Posted {formatDate(memory.date)}</> : "Posted recently"}
            {memory.imageUrls && memory.imageUrls.length > 0
              ? ` · ${memory.imageUrls.length} ${memory.imageUrls.length === 1 ? "photo" : "photos"}`
              : null}
          </p>
          {memory.description ? (
            <p className="mt-4" style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 560 }}>
              {memory.description}
            </p>
          ) : null}
        </div>
      </Link>
    </div>
  );
}

// =============================================================================
// Today panel — birthdays
// =============================================================================
type Birthday = { person: Person; date: Date; daysUntil: number };

function TodayPanel({
  birthdays,
  fallbackHref,
  familyTreeReady,
}: {
  birthdays: Birthday[];
  fallbackHref: string;
  familyTreeReady: boolean;
}) {
  if (birthdays.length === 0) {
    return (
      <div>
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          Today
        </p>
        <div
          className="rounded-lg p-7"
          style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
        >
          <p className="display-italic" style={{ fontSize: 18, margin: 0, color: "var(--ink-2)" }}>
            Quiet on the page today.
          </p>
          <p className="muted mt-2" style={{ fontSize: 14 }}>
            No birthdays in the next 31 days.
          </p>
          <div className="mt-5">
            <Link href={fallbackHref} style={{ textDecoration: "none" }}>
              <Button variant="ghost" size="sm" icon="arrow">
                {familyTreeReady ? "Open family tree" : "Find your family"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [first, ...rest] = birthdays;

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Today
      </p>
      <div
        className="rounded-lg p-7"
        style={{ background: "var(--paper)", border: "1px solid var(--hairline)" }}
      >
        <BirthdayHeadline birthday={first} />
        {rest.length > 0 ? (
          <div className="mt-5">
            <div className="eyebrow mb-3">Also coming up</div>
            <ul className="m-0 list-none p-0">
              {rest.map((b, i) => (
                <li
                  key={b.person.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{
                    borderTop: i === 0 ? "none" : "1px dotted var(--hairline)",
                  }}
                >
                  <Avatar
                    src={b.person.profilePhotoUrl}
                    name={`${b.person.firstName} ${b.person.lastName}`}
                    size={32}
                  />
                  <Link
                    href={`/profile/${b.person.id}`}
                    className="min-w-0 flex-1"
                    style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}
                  >
                    <div>
                      {b.person.firstName} turns{" "}
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
                        {getAge(b.person.birthDate!) + (b.daysUntil === 0 ? 0 : 1)}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {b.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                      {b.daysUntil === 0
                        ? "today"
                        : b.daysUntil === 1
                          ? "tomorrow"
                          : `in ${b.daysUntil} days`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BirthdayHeadline({ birthday }: { birthday: Birthday }) {
  const { person, date, daysUntil } = birthday;
  const turning = getAge(person.birthDate!) + (daysUntil === 0 ? 0 : 1);
  const headline =
    daysUntil === 0
      ? `${person.firstName} turns ${turning} today`
      : daysUntil === 1
        ? `${person.firstName} turns ${turning} tomorrow`
        : `${person.firstName} turns ${turning}`;

  return (
    <>
      <div className="mb-4 flex items-center gap-3.5">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "var(--clay-tint)", color: "var(--clay-deep)" }}
        >
          <Icon name="cake" size={20} />
        </div>
        <div>
          <div className="eyebrow">Birthday this {daysUntil <= 7 ? "week" : "month"}</div>
          <div className="display" style={{ fontSize: 22, fontWeight: 500 }}>
            {headline}
          </div>
        </div>
      </div>
      <Link
        href={`/profile/${person.id}`}
        className="flex items-center gap-3 rounded-md px-3.5 py-3"
        style={{
          background: "var(--paper-2)",
          textDecoration: "none",
          color: "var(--ink)",
        }}
      >
        <Avatar
          src={person.profilePhotoUrl}
          name={`${person.firstName} ${person.lastName}`}
          size={40}
        />
        <div className="min-w-0 flex-1" style={{ fontSize: 14 }}>
          <div style={{ fontWeight: 500 }}>
            {date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {[person.city, person.state].filter(Boolean).join(", ") || "Family"}
          </div>
        </div>
        <Chip tone="clay">
          {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
        </Chip>
      </Link>
    </>
  );
}

// =============================================================================
// Lower grid columns
// =============================================================================
function InMemoryColumn({ person }: { person: Person }) {
  const lifespan = (() => {
    const birth = person.birthDate?.match(/^(\d{4})/)?.[1];
    const death = person.deathDate?.match(/^(\d{4})/)?.[1];
    if (birth && death) return `${birth}–${death}`;
    if (death) return `d. ${death}`;
    return null;
  })();

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        In memory
      </p>
      <div className="flex items-start gap-3">
        <PhotoFrame
          src={person.profilePhotoUrl}
          alt={`${person.firstName} ${person.lastName}`}
          ratio="3 / 4"
          rounded={2}
          frame
          style={{ width: 80, flexShrink: 0 }}
        />
        <div>
          <h4 className="display-italic m-0" style={{ fontSize: 20 }}>
            {person.firstName}
            {person.middleName ? ` ${person.middleName}` : ""}
          </h4>
          {lifespan ? (
            <p className="muted" style={{ fontSize: 13, margin: "2px 0 10px" }}>
              {lifespan}
            </p>
          ) : null}
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: "var(--ink-2)" }}>
            Remembered on the page.
          </p>
          <Link
            href={`/profile/${person.id}`}
            className="mt-2.5 inline-flex items-center gap-1"
            style={{ fontSize: 13, color: "var(--sage-deep)", textDecoration: "none" }}
          >
            Visit their page <Icon name="arrow" size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function RecentlyAddedColumn({ memories }: { memories: Memory[] }) {
  if (memories.length === 0) {
    return (
      <div>
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          Recently added
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          Nothing recent yet.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Recently added
      </p>
      <div className="flex flex-col gap-2.5">
        {memories.map((m, i) => (
          <Link
            key={m.id}
            href="/memories"
            className="block pb-2.5"
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              borderBottom: i < memories.length - 1 ? "1px dotted var(--hairline)" : "none",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <span style={{ fontStyle: "italic", fontFamily: "var(--font-display)", fontSize: 15 }}>
              {m.title}
            </span>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {m.date ? formatDate(m.date) : new Date(m.createdAt).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function YourBranchColumn({ me, people }: { me: Person; people: Person[] }) {
  const ids = new Set<string>([
    ...(me.parentIds ?? []),
    ...(me.spouseIds ?? []),
    ...(me.childIds ?? []),
  ]);
  const branch = people.filter((p) => ids.has(p.id)).slice(0, 8);

  if (branch.length === 0) {
    return (
      <div>
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          Your branch
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          Add parents, a spouse, or children to start building your branch.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Your branch
      </p>
      <div className="grid grid-cols-4 gap-2">
        {branch.map((p) => (
          <Link
            key={p.id}
            href={`/profile/${p.id}`}
            className="block text-center"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            <Avatar src={p.profilePhotoUrl} name={`${p.firstName} ${p.lastName}`} size={48} />
            <div className="display mt-1.5" style={{ fontSize: 12, fontWeight: 500 }}>
              {p.firstName}
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/family-tree"
        className="mt-3.5 inline-flex items-center gap-1"
        style={{ fontSize: 13, color: "var(--sage-deep)", textDecoration: "none" }}
      >
        Open family tree <Icon name="arrow" size={12} />
      </Link>
    </div>
  );
}

// =============================================================================
// Getting started card — quiet checklist, only shown for new users
// =============================================================================
type Step = { label: string; done: boolean; href: string };

function GettingStartedCard({
  steps,
  completedSteps,
}: {
  steps: Step[];
  completedSteps: number;
}) {
  const pct = (completedSteps / steps.length) * 100;
  return (
    <div
      className="rounded-lg p-6"
      style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="display m-0"
          style={{ fontSize: 22, fontWeight: 500, color: "var(--ink)" }}
        >
          Getting started
        </h2>
        <span className="eyebrow">
          {completedSteps}/{steps.length} done
        </span>
      </div>
      <div
        className="mb-5 h-1 w-full overflow-hidden rounded-full"
        style={{ background: "var(--hairline)" }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--sage-deep)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5"
              style={{
                background: step.done ? "transparent" : "var(--paper)",
                border: "1px solid var(--hairline)",
                color: "var(--ink)",
                textDecoration: "none",
                opacity: step.done ? 0.6 : 1,
              }}
            >
              <span
                className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  background: step.done ? "var(--sage-tint)" : "transparent",
                  color: "var(--sage-deep)",
                  border: `1px solid ${step.done ? "var(--sage-soft)" : "var(--hairline-strong)"}`,
                }}
              >
                {step.done ? <Icon name="check" size={12} /> : null}
              </span>
              <span
                style={{
                  fontSize: 14,
                  textDecoration: step.done ? "line-through" : "none",
                  fontWeight: step.done ? 400 : 500,
                }}
              >
                {step.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Invite family — copies a signup link if a family exists, else jumps to /families
// =============================================================================
function InviteFamilyButton({ familyId }: { familyId?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!familyId) return;
    const url = `${window.location.origin}/signup?family=${familyId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [familyId]);

  if (!familyId) {
    return (
      <Link href="/families" style={{ textDecoration: "none" }}>
        <Button variant="ghost" icon="people">
          Invite family
        </Button>
      </Link>
    );
  }

  return (
    <Button variant="ghost" icon="people" onClick={handleCopy}>
      {copied ? "Link copied" : "Invite family"}
    </Button>
  );
}
