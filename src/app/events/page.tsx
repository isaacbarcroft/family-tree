"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { deleteEvent, listEvents, updateEvent } from "@/lib/db";
import type { Event } from "@/models/Event";
import type { Person } from "@/models/Person";
import ProtectedRoute from "@/components/ProtectedRoute";
import AddEventModal from "@/components/AddEventModal";
import { supabase } from "@/lib/supabase";
import { SkeletonCard, SkeletonLine } from "@/components/SkeletonLoader";
import { Button, Chip, type IconName } from "@/components/ui";
import { formatDate } from "@/utils/dates";
import { EVENT_TYPES, type EventType } from "@/constants/enums";

const PAGE_SIZE = 25;

const EVENT_ICON: Record<EventType, IconName> = {
  life: "event",
  memory: "memory",
  historical: "book",
};

const EVENT_TONE: Record<EventType, "default" | "sage" | "clay"> = {
  life: "sage",
  memory: "default",
  historical: "clay",
};

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [peopleMap, setPeopleMap] = useState<Map<string, Person>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Event>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchPeopleForEvents = async (eventData: Event[]) => {
    const allPeopleIds = Array.from(new Set(eventData.flatMap((e) => e.peopleIds)));
    if (allPeopleIds.length === 0) return;
    const { data: people } = await supabase
      .from("people")
      .select("*")
      .in("id", allPeopleIds);
    if (!people) return;
    setPeopleMap((prev) => {
      const map = new Map(prev);
      for (const p of people as Person[]) map.set(p.id, p);
      return map;
    });
  };

  const fetchEvents = async (pageNum = 1, replace = true) => {
    try {
      const result = await listEvents({ page: pageNum, pageSize: PAGE_SIZE, paginate: true });
      const data = result.data;
      setEvents((prev) => (replace ? data : [...prev, ...data]));
      setTotal(result.total);
      setPage(pageNum);
      await fetchPeopleForEvents(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const hasMore = total !== null && events.length < total;

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchEvents(page + 1, false);
    setLoadingMore(false);
  };

  const handleEdit = (e: Event) => {
    setEditingId(e.id);
    setEditForm({ title: e.title, date: e.date, type: e.type, description: e.description ?? "" });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateEvent(editingId, editForm);
      setEditingId(null);
      await fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      setConfirmDeleteId(null);
      await fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-4xl space-y-4 px-6 py-12 md:px-12">
          <SkeletonLine className="mb-4 h-10 w-40" />
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div
          className="display-italic"
          style={{ textAlign: "center", padding: "96px 24px", color: "var(--clay-deep)", fontSize: 18 }}
        >
          {error}
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div
        className="mx-auto px-6 pb-16 pt-10 md:px-12"
        style={{ background: "var(--paper)", color: "var(--ink)", maxWidth: 1080 }}
      >
        <div
          className="mb-8 flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              Milestones &amp; gatherings
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
              Events
            </h1>
            {total !== null ? (
              <p className="muted mt-1.5" style={{ fontSize: 14 }}>
                {total} {total === 1 ? "event" : "events"} on the calendar
              </p>
            ) : null}
          </div>
          <Button variant="primary" icon="plus" onClick={() => setShowAddModal(true)}>
            Add event
          </Button>
        </div>

        {events.length === 0 ? (
          <div
            className="rounded-lg p-12 text-center"
            style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
          >
            <p className="display-italic muted" style={{ fontSize: 22, margin: 0 }}>
              No events yet.
            </p>
            <p className="muted mt-2" style={{ fontSize: 14 }}>
              Add milestones, celebrations, and important moments.
            </p>
            <div className="mt-5">
              <Button variant="primary" icon="plus" onClick={() => setShowAddModal(true)}>
                Add event
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="m-0 list-none space-y-4 p-0">
              {events.map((e) => {
                const isEditing = editingId === e.id;
                const isOwner = user?.id === e.createdBy;
                return (
                  <li
                    key={e.id}
                    className="rounded-md p-5"
                    style={{ background: "var(--paper)", border: "1px solid var(--hairline)" }}
                  >
                    {isEditing ? (
                      <EventEditForm
                        form={editForm}
                        onChange={(field, value) =>
                          setEditForm((f) => ({ ...f, [field]: value }))
                        }
                        onSave={handleSaveEdit}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <EventRow
                        event={e}
                        peopleMap={peopleMap}
                        isOwner={isOwner}
                        confirmDelete={confirmDeleteId === e.id}
                        onEdit={() => handleEdit(e)}
                        onConfirmDelete={() => setConfirmDeleteId(e.id)}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                        onDelete={() => handleDelete(e.id)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {hasMore ? (
              <div className="mt-10 text-center">
                <Button variant="ghost" icon="arrow" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}

        {showAddModal ? (
          <AddEventModal
            onClose={() => setShowAddModal(false)}
            onCreated={fetchEvents}
          />
        ) : null}
      </div>
    </ProtectedRoute>
  );
}

function EventRow({
  event: e,
  peopleMap,
  isOwner,
  confirmDelete,
  onEdit,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}: {
  event: Event;
  peopleMap: Map<string, Person>;
  isOwner: boolean;
  confirmDelete: boolean;
  onEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <h3
            className="display m-0"
            style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)" }}
          >
            {e.title}
          </h3>
          <Chip tone={EVENT_TONE[e.type]} icon={EVENT_ICON[e.type]}>
            {e.type}
          </Chip>
          <span className="muted" style={{ fontSize: 13 }}>
            {formatDate(e.date)}
          </span>
        </div>
        {e.description ? (
          <p
            className="mt-2 whitespace-pre-line"
            style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 640 }}
          >
            {e.description}
          </p>
        ) : null}
        {e.peopleIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {e.peopleIds.map((pid) => {
              const person = peopleMap.get(pid);
              if (!person) return null;
              return (
                <Link key={pid} href={`/profile/${pid}`} style={{ textDecoration: "none" }}>
                  <Chip tone="sage" icon="people">
                    {person.firstName} {person.lastName}
                  </Chip>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
      {isOwner ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" icon="pencil" onClick={onEdit}>
            Edit
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="primary" size="sm" onClick={onDelete}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelDelete}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" icon="close" onClick={onConfirmDelete}>
              Delete
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EventEditForm({
  form,
  onChange,
  onSave,
  onCancel,
}: {
  form: Partial<Event>;
  onChange: (field: keyof Event, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const inputStyle = {
    background: "var(--paper-2)",
    color: "var(--ink)",
    border: "1px solid var(--hairline)",
    fontSize: 15,
  };
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={form.title ?? ""}
        onChange={(ev) => onChange("title", ev.target.value)}
        className="w-full rounded-md p-2.5"
        style={inputStyle}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="date"
          value={form.date ?? ""}
          onChange={(ev) => onChange("date", ev.target.value)}
          className="w-full rounded-md p-2.5"
          style={inputStyle}
        />
        <select
          value={form.type ?? "life"}
          onChange={(ev) => onChange("type", ev.target.value)}
          className="w-full rounded-md p-2.5"
          style={inputStyle}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={form.description ?? ""}
        onChange={(ev) => onChange("description", ev.target.value)}
        rows={3}
        className="w-full rounded-md p-2.5"
        style={inputStyle}
      />
      <div className="flex gap-2">
        <Button variant="primary" size="sm" icon="check" onClick={onSave}>
          Save
        </Button>
        <Button variant="ghost" size="sm" icon="close" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
