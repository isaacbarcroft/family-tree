"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { deleteMemory, listMemories, updateMemory } from "@/lib/db";
import type { Memory } from "@/models/Memory";
import type { Person } from "@/models/Person";
import ProtectedRoute from "@/components/ProtectedRoute";
import AddMemoryModal from "@/components/AddMemoryModal";
import { supabase } from "@/lib/supabase";
import { SkeletonCard, SkeletonLine } from "@/components/SkeletonLoader";
import { Button, Chip, Icon, PhotoFrame } from "@/components/ui";
import { formatDate } from "@/utils/dates";
import { toDisplayImageUrl } from "@/utils/imageUrl";

const PAGE_SIZE = 24;

export default function MemoriesPage() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [peopleMap, setPeopleMap] = useState<Map<string, Person>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Memory>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchPeopleForMemories = async (memData: Memory[]) => {
    const allPeopleIds = Array.from(new Set(memData.flatMap((m) => m.peopleIds)));
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

  const fetchMemories = async (pageNum = 1, replace = true) => {
    try {
      const result = await listMemories({
        page: pageNum,
        pageSize: PAGE_SIZE,
        paginate: true,
      });
      const data = result.data;
      setMemories((prev) => (replace ? data : [...prev, ...data]));
      setTotal(result.total);
      setPage(pageNum);
      await fetchPeopleForMemories(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load memories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const hasMore = total !== null && memories.length < total;

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchMemories(page + 1, false);
    setLoadingMore(false);
  };

  const handleEdit = (m: Memory) => {
    setEditingId(m.id);
    setExpandedId(m.id);
    setEditForm({ title: m.title, date: m.date, description: m.description ?? "" });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateMemory(editingId, editForm);
      setEditingId(null);
      await fetchMemories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      setConfirmDeleteId(null);
      setExpandedId(null);
      await fetchMemories();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-5xl space-y-4 px-6 py-12 md:px-12">
          <SkeletonLine className="mb-4 h-10 w-48" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} className="h-48" />
            ))}
          </div>
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
        style={{ background: "var(--paper)", color: "var(--ink)", maxWidth: 1280 }}
      >
        <div
          className="mb-8 flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              The family album
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
              Memories
            </h1>
            {total !== null ? (
              <p className="muted mt-1.5" style={{ fontSize: 14 }}>
                {total} {total === 1 ? "memory" : "memories"} on the page
              </p>
            ) : null}
          </div>
          <Button variant="primary" icon="plus" onClick={() => setShowAddModal(true)}>
            Add memory
          </Button>
        </div>

        {memories.length === 0 ? (
          <div
            className="rounded-lg p-12 text-center"
            style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
          >
            <p className="display-italic muted" style={{ fontSize: 22, margin: 0 }}>
              No memories yet.
            </p>
            <p className="muted mt-2" style={{ fontSize: 14 }}>
              Be the first to share a family memory.
            </p>
            <div className="mt-5">
              <Button variant="primary" icon="photo" onClick={() => setShowAddModal(true)}>
                Add memory
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {memories.map((m) => {
                const isExpanded = expandedId === m.id;
                const isEditing = editingId === m.id;
                const isOwner = user?.id === m.createdBy;
                return (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    isExpanded={isExpanded}
                    isEditing={isEditing}
                    isOwner={isOwner}
                    peopleMap={peopleMap}
                    editForm={editForm}
                    confirmDelete={confirmDeleteId === m.id}
                    onExpand={() => setExpandedId(isExpanded ? null : m.id)}
                    onEdit={() => handleEdit(m)}
                    onCancelEdit={() => setEditingId(null)}
                    onUpdateField={(field, value) =>
                      setEditForm((f) => ({ ...f, [field]: value }))
                    }
                    onSaveEdit={handleSaveEdit}
                    onConfirmDelete={() => setConfirmDeleteId(m.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onDelete={() => handleDelete(m.id)}
                  />
                );
              })}
            </div>
            {hasMore ? (
              <div className="mt-10 text-center">
                <Button
                  variant="ghost"
                  onClick={loadMore}
                  disabled={loadingMore}
                  icon="arrow"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}

        {showAddModal ? (
          <AddMemoryModal
            onClose={() => setShowAddModal(false)}
            onCreated={fetchMemories}
          />
        ) : null}
      </div>
    </ProtectedRoute>
  );
}

// =============================================================================
// Memory card — collapsed by default, expands to full-row with description,
// photo grid, and person chips
// =============================================================================
type MemoryCardProps = {
  memory: Memory;
  isExpanded: boolean;
  isEditing: boolean;
  isOwner: boolean;
  peopleMap: Map<string, Person>;
  editForm: Partial<Memory>;
  confirmDelete: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdateField: (field: keyof Memory, value: string) => void;
  onSaveEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
};

function MemoryCard({
  memory: m,
  isExpanded,
  isEditing,
  isOwner,
  peopleMap,
  editForm,
  confirmDelete,
  onExpand,
  onEdit,
  onCancelEdit,
  onUpdateField,
  onSaveEdit,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}: MemoryCardProps) {
  const heroSrc = m.imageUrls && m.imageUrls[0] ? toDisplayImageUrl(m.imageUrls[0]) : null;

  return (
    <article
      className={`overflow-hidden rounded-md transition-colors ${
        isExpanded ? "sm:col-span-2 lg:col-span-3" : ""
      }`}
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!isEditing) onExpand();
        }}
        className="block w-full text-left"
        style={{ background: "transparent", border: "none", cursor: isEditing ? "default" : "pointer", padding: 0 }}
      >
        <PhotoFrame
          src={heroSrc}
          alt={m.title}
          ratio={isExpanded ? "21 / 9" : "4 / 3"}
          rounded={0}
          label={m.title}
        />
      </button>

      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editForm.title ?? ""}
              onChange={(e) => onUpdateField("title", e.target.value)}
              className="w-full rounded-md p-2.5"
              style={{
                background: "var(--paper-2)",
                color: "var(--ink)",
                border: "1px solid var(--hairline)",
                fontSize: 15,
              }}
            />
            <input
              type="date"
              value={editForm.date ?? ""}
              onChange={(e) => onUpdateField("date", e.target.value)}
              className="w-full rounded-md p-2.5"
              style={{
                background: "var(--paper-2)",
                color: "var(--ink)",
                border: "1px solid var(--hairline)",
                fontSize: 15,
              }}
            />
            <textarea
              value={editForm.description ?? ""}
              onChange={(e) => onUpdateField("description", e.target.value)}
              rows={3}
              className="w-full rounded-md p-2.5"
              style={{
                background: "var(--paper-2)",
                color: "var(--ink)",
                border: "1px solid var(--hairline)",
                fontSize: 15,
              }}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" icon="check" onClick={onSaveEdit}>
                Save
              </Button>
              <Button variant="ghost" size="sm" icon="close" onClick={onCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3
                className="display m-0"
                style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)" }}
              >
                {m.title}
              </h3>
              {isExpanded && isOwner ? (
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
            <p className="muted mt-1" style={{ fontSize: 13 }}>
              {m.date ? formatDate(m.date) : ""}
              {m.peopleIds.length > 0 ? ` · ${m.peopleIds.length} tagged` : ""}
            </p>

            {isExpanded ? (
              <>
                {m.description ? (
                  <p
                    className="mt-3 whitespace-pre-line"
                    style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}
                  >
                    {m.description}
                  </p>
                ) : null}

                {m.imageUrls && m.imageUrls.length > 1 ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {m.imageUrls.map((url, i) => (
                      <PhotoFrame
                        key={i}
                        src={toDisplayImageUrl(url)}
                        alt={`${m.title} ${i + 1}`}
                        ratio="1 / 1"
                        rounded={2}
                      />
                    ))}
                  </div>
                ) : null}

                {m.peopleIds.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {m.peopleIds.map((pid) => {
                      const person = peopleMap.get(pid);
                      if (!person) return null;
                      return (
                        <Link
                          key={pid}
                          href={`/profile/${pid}`}
                          style={{ textDecoration: "none" }}
                        >
                          <Chip tone="sage" icon="people">
                            {person.firstName} {person.lastName}
                          </Chip>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>

      {!isExpanded && !isEditing ? (
        <div
          className="flex items-center justify-end gap-1 px-4 pb-3"
          style={{ color: "var(--ink-3)", fontSize: 12 }}
        >
          <span>Open</span>
          <Icon name="chevronRight" size={12} />
        </div>
      ) : null}
    </article>
  );
}
