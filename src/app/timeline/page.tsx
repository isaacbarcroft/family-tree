"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listEvents, listMemories, listPeople } from "@/lib/db";
import type { Event } from "@/models/Event";
import type { Memory } from "@/models/Memory";
import type { Person } from "@/models/Person";
import { SkeletonCard, SkeletonLine } from "@/components/SkeletonLoader";
import { Chip, Icon, PhotoFrame } from "@/components/ui";
import type { TimelineItem } from "@/utils/timeline";
import { formatDate, parseLocalDate } from "@/utils/dates";
import { toDisplayImageUrl } from "@/utils/imageUrl";

type Filter = "all" | "event" | "memory";

function dotColor(item: TimelineItem): string {
  if (item.type === "memory") return "var(--sage)";
  if (item.eventType === "historical") return "var(--clay-deep)";
  return "var(--sage-deep)";
}

function chipTone(item: TimelineItem): "default" | "sage" | "clay" {
  if (item.type === "memory") return "sage";
  if (item.eventType === "historical") return "clay";
  return "default";
}

export default function TimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleMap, setPeopleMap] = useState<Map<string, Person>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<Filter>("all");
  const [filterPerson, setFilterPerson] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [events, memories, allPeople] = await Promise.all([
          listEvents(),
          listMemories(),
          listPeople(),
        ]);
        const map = new Map<string, Person>();
        for (const p of allPeople) map.set(p.id, p);
        setPeopleMap(map);
        setPeople(allPeople);

        const eventItems: TimelineItem[] = events.map((e: Event) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          type: "event" as const,
          description: e.description,
          peopleIds: e.peopleIds,
          eventType: e.type,
        }));
        const memoryItems: TimelineItem[] = memories.map((m: Memory) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          type: "memory" as const,
          description: m.description,
          imageUrl: m.imageUrls?.[0],
          peopleIds: m.peopleIds,
        }));
        const all = [...eventItems, ...memoryItems].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setItems(all);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filtered = items.filter((i) => {
    if (filterType !== "all" && i.type !== filterType) return false;
    if (filterPerson && !i.peopleIds.includes(filterPerson)) return false;
    return true;
  });

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-12">
          <SkeletonLine className="mb-4 h-10 w-48" />
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div
        className="mx-auto px-6 pb-16 pt-10 md:px-12"
        style={{ background: "var(--paper)", color: "var(--ink)", maxWidth: 960 }}
      >
        <div
          className="mb-10 flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              The page, year by year
            </p>
            <h1
              className="display"
              style={{
                fontSize: "clamp(36px, 5vw, 48px)",
                margin: 0,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              Timeline
            </h1>
            <p className="muted mt-1.5" style={{ fontSize: 14 }}>
              {items.length} {items.length === 1 ? "entry" : "entries"} from your family history
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-10 flex flex-wrap items-center gap-3">
          <FilterToggle value={filterType} onChange={setFilterType} />
          <select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            className="rounded-full px-4 py-2"
            style={{
              background: "var(--paper-2)",
              color: "var(--ink)",
              border: "1px solid var(--hairline)",
              fontSize: 13,
              minHeight: 36,
            }}
          >
            <option value="">All people</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div
            className="rounded-lg p-12 text-center"
            style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
          >
            <p className="display-italic muted" style={{ fontSize: 22, margin: 0 }}>
              Nothing on the timeline yet.
            </p>
            <p className="muted mt-2" style={{ fontSize: 14 }}>
              Add a memory or an event to start the page.
            </p>
          </div>
        ) : (
          <div className="relative" style={{ paddingLeft: 110 }}>
            {/* Vertical hairline */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 80,
                top: 6,
                bottom: 0,
                width: 1,
                background: "var(--hairline)",
              }}
            />
            {filtered.map((item) => (
              <TimelineRow
                key={`${item.type}-${item.id}`}
                item={item}
                peopleMap={peopleMap}
              />
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function FilterToggle({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  const opts: { v: Filter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "event", label: "Events" },
    { v: "memory", label: "Memories" },
  ];
  return (
    <div
      className="flex rounded-full p-1"
      style={{ border: "1px solid var(--hairline)" }}
    >
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={active}
            className="rounded-full px-3.5 transition-colors"
            style={{
              background: active ? "var(--paper-2)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-3)",
              fontSize: 13,
              fontWeight: 500,
              minHeight: 30,
              border: "none",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TimelineRow({
  item,
  peopleMap,
}: {
  item: TimelineItem;
  peopleMap: Map<string, Person>;
}) {
  const year = item.date ? parseLocalDate(item.date).getFullYear() : "";
  const color = dotColor(item);
  const tone = chipTone(item);
  const label = item.type === "memory" ? "memory" : item.eventType ?? "event";
  const photoSrc = item.imageUrl ? toDisplayImageUrl(item.imageUrl) : null;

  return (
    <div className="relative" style={{ paddingBottom: 32 }}>
      {/* Year — left-aligned outside the rail */}
      <span
        className="display"
        style={{
          position: "absolute",
          left: -38,
          top: 6,
          fontSize: 18,
          fontWeight: 500,
          color: "var(--ink-2)",
          width: 60,
          textAlign: "right",
        }}
      >
        {year}
      </span>
      {/* Dot */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -5,
          top: 9,
          width: 11,
          height: 11,
          borderRadius: 999,
          background: "var(--paper)",
          border: `2px solid ${color}`,
        }}
      />
      <div className="flex items-start gap-4">
        {photoSrc ? (
          <PhotoFrame
            src={photoSrc}
            alt={item.title}
            ratio="1 / 1"
            rounded={2}
            style={{ width: 64, flexShrink: 0 }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Chip tone={tone}>{label}</Chip>
            <span className="muted" style={{ fontSize: 12 }}>
              {formatDate(item.date)}
            </span>
          </div>
          <h3
            className="display"
            style={{ fontSize: 20, fontWeight: 500, margin: "6px 0 0", color: "var(--ink)" }}
          >
            {item.title}
          </h3>
          {item.description ? (
            <p
              className="mt-2"
              style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 620 }}
            >
              {item.description}
            </p>
          ) : null}
          {item.peopleIds.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {item.peopleIds.slice(0, 5).map((pid) => {
                const person = peopleMap.get(pid);
                if (!person) return null;
                return (
                  <Link
                    key={pid}
                    href={`/profile/${pid}`}
                    style={{
                      fontSize: 13,
                      color: "var(--sage-deep)",
                      textDecoration: "none",
                    }}
                  >
                    {person.firstName} {person.lastName}
                  </Link>
                );
              })}
              {item.peopleIds.length > 5 ? (
                <span className="muted" style={{ fontSize: 13 }}>
                  +{item.peopleIds.length - 5} more
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
