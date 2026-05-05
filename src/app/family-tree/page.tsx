"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { addPerson, deletePerson, listPeople } from "@/lib/db";
import type { Person } from "@/models/Person";
import { useAuth } from "@/components/AuthProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonPage } from "@/components/SkeletonLoader";
import ImportGedcomModal from "@/components/ImportGedcomModal";
import { Avatar, Button, Icon, PhotoFrame } from "@/components/ui";
import { PAGE_SIZE } from "@/config/constants";

type View = "grid" | "list";

function lifespan(p: Person): string {
  const birth = p.birthDate?.match(/^(\d{4})/)?.[1];
  const death = p.deathDate?.match(/^(\d{4})/)?.[1];
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return "";
}

export default function FamilyTreePage() {
  const { user } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [view, setView] = useState<View>("grid");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    roleType: "family member",
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const fetchPage = async (pageNum: number, replace = false) => {
    const result = await listPeople({ page: pageNum, pageSize: PAGE_SIZE.PEOPLE, paginate: true });
    setPeople((prev) => (replace ? result.data : [...prev, ...result.data]));
    setTotal(result.total);
    setPage(pageNum);
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchPage(1, true);
      setLoading(false);
    };
    fetchData();
  }, []);

  const hasMore = total !== null && people.length < total;

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchPage(page + 1);
    setLoadingMore(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const newPerson: Omit<Person, "id"> = {
      firstName: form.firstName,
      lastName: form.lastName,
      roleType: form.roleType as Person["roleType"],
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    await addPerson(newPerson);
    await fetchPage(1, true);
    setForm({ firstName: "", lastName: "", roleType: "family member" });
    setShowForm(false);
  };

  return (
    <ProtectedRoute>
      <div
        className="mx-auto px-6 py-10 md:px-12 md:py-14"
        style={{ background: "var(--paper)", color: "var(--ink)", maxWidth: 1280 }}
      >
        {/* Header */}
        <div
          className="mb-7 flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              The family
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
              People
            </h1>
            {total !== null ? (
              <p className="muted mt-1.5" style={{ fontSize: 14 }}>
                {total} {total === 1 ? "relative" : "relatives"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <ViewToggle view={view} onChange={setView} />
            <Button variant="ghost" size="md" icon="arrow" onClick={() => setShowImportModal(true)}>
              Import GEDCOM
            </Button>
            <Button
              variant={showForm ? "ghost" : "primary"}
              icon={showForm ? "close" : "plus"}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Cancel" : "Add person"}
            </Button>
          </div>
        </div>

        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-lg p-5"
            style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                name="firstName"
                placeholder="First name"
                value={form.firstName}
                onChange={handleChange}
                className="rounded-md p-3"
                style={{
                  background: "var(--paper)",
                  color: "var(--ink)",
                  border: "1px solid var(--hairline)",
                  fontSize: 15,
                }}
                required
              />
              <input
                type="text"
                name="lastName"
                placeholder="Last name"
                value={form.lastName}
                onChange={handleChange}
                className="rounded-md p-3"
                style={{
                  background: "var(--paper)",
                  color: "var(--ink)",
                  border: "1px solid var(--hairline)",
                  fontSize: 15,
                }}
                required
              />
            </div>
            <select
              name="roleType"
              value={form.roleType}
              onChange={handleChange}
              className="mt-3 w-full rounded-md p-3"
              style={{
                background: "var(--paper)",
                color: "var(--ink)",
                border: "1px solid var(--hairline)",
                fontSize: 15,
              }}
            >
              <option value="family member">Family member</option>
              <option value="friend">Friend</option>
              <option value="neighbor">Neighbor</option>
              <option value="pastor">Pastor</option>
              <option value="other">Other</option>
            </select>
            <div className="mt-4">
              <Button type="submit" variant="primary" icon="check">
                Add person
              </Button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <SkeletonPage rows={5} />
        ) : people.length === 0 ? (
          <div className="rounded-lg p-12 text-center" style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}>
            <p className="display-italic muted" style={{ fontSize: 22, margin: 0 }}>
              No family members yet.
            </p>
            <p className="muted mt-2" style={{ fontSize: 14 }}>
              Add the first person to start the page.
            </p>
            <div className="mt-5">
              <Button variant="primary" icon="plus" onClick={() => setShowForm(true)}>
                Add person
              </Button>
            </div>
          </div>
        ) : (
          <>
            {view === "grid" ? (
              <PeopleGrid
                people={people}
                user={user}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
                onDelete={async (id) => {
                  await deletePerson(id);
                  setConfirmDeleteId(null);
                  await fetchPage(1, true);
                }}
              />
            ) : (
              <PeopleList
                people={people}
                user={user}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
                onDelete={async (id) => {
                  await deletePerson(id);
                  setConfirmDeleteId(null);
                  await fetchPage(1, true);
                }}
              />
            )}
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

        {showImportModal ? (
          <ImportGedcomModal
            onClose={() => setShowImportModal(false)}
            onImported={() => fetchPage(1, true)}
          />
        ) : null}
      </div>
    </ProtectedRoute>
  );
}

// =============================================================================
// View toggle
// =============================================================================
function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const baseStyle = {
    minHeight: 30,
    padding: "6px 12px",
    fontSize: 13,
    color: "var(--ink)",
  } as const;
  return (
    <div
      className="flex rounded-full p-1"
      style={{ border: "1px solid var(--hairline)" }}
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={view === "grid"}
        className="ui-btn inline-flex cursor-pointer items-center gap-1.5 rounded-full transition-colors"
        data-variant={view === "grid" ? "quiet" : "ghost"}
        style={{
          ...baseStyle,
          background: view === "grid" ? "var(--paper-2)" : "transparent",
          border: "none",
        }}
      >
        <Icon name="grid" size={14} /> Grid
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        className="ui-btn inline-flex cursor-pointer items-center gap-1.5 rounded-full transition-colors"
        data-variant={view === "list" ? "quiet" : "ghost"}
        style={{
          ...baseStyle,
          background: view === "list" ? "var(--paper-2)" : "transparent",
          border: "none",
        }}
      >
        <Icon name="list" size={14} /> List
      </button>
    </div>
  );
}

// =============================================================================
// People — grid view
// =============================================================================
type PeopleViewProps = {
  people: Person[];
  user: { id: string } | null;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onDelete: (id: string) => void;
};

function PeopleGrid({ people, user, confirmDeleteId, setConfirmDeleteId, onDelete }: PeopleViewProps) {
  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
      {people.map((p) => (
        <PersonCard
          key={p.id}
          person={p}
          user={user}
          confirmDeleteId={confirmDeleteId}
          setConfirmDeleteId={setConfirmDeleteId}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function PersonCard({
  person: p,
  user,
  confirmDeleteId,
  setConfirmDeleteId,
  onDelete,
}: {
  person: Person;
  user: { id: string } | null;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const showDelete = user?.id === p.createdBy;
  return (
    <div className="relative">
      <Link
        href={`/profile/${p.id}`}
        className="block"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <PhotoFrame src={p.profilePhotoUrl} alt={fullName} ratio="3 / 4" rounded={4} frame label={p.firstName} />
        <div className="mt-3">
          <div
            className="display"
            style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)" }}
          >
            {p.firstName}{" "}
            <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{p.lastName}</span>
          </div>
          <div className="muted mt-0.5" style={{ fontSize: 12 }}>
            {[lifespan(p), p.roleType].filter(Boolean).join(" · ")}
          </div>
        </div>
      </Link>
      {showDelete ? (
        <div className="absolute right-2 top-2">
          {confirmDeleteId === p.id ? (
            <ConfirmDialog
              onConfirm={() => onDelete(p.id)}
              onCancel={() => setConfirmDeleteId(null)}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setConfirmDeleteId(p.id);
              }}
              aria-label={`Delete ${fullName}`}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline-strong)",
                color: "var(--ink-3)",
              }}
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// =============================================================================
// People — list view
// =============================================================================
function PeopleList({ people, user, confirmDeleteId, setConfirmDeleteId, onDelete }: PeopleViewProps) {
  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{ background: "var(--paper)", border: "1px solid var(--hairline)" }}
    >
      {people.map((p, i) => (
        <PersonRow
          key={p.id}
          person={p}
          user={user}
          confirmDeleteId={confirmDeleteId}
          setConfirmDeleteId={setConfirmDeleteId}
          onDelete={onDelete}
          isFirst={i === 0}
        />
      ))}
    </div>
  );
}

function PersonRow({
  person: p,
  user,
  confirmDeleteId,
  setConfirmDeleteId,
  onDelete,
  isFirst,
}: {
  person: Person;
  user: { id: string } | null;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onDelete: (id: string) => void;
  isFirst: boolean;
}) {
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const showDelete = user?.id === p.createdBy;
  const ls = lifespan(p);
  return (
    <div
      className="relative flex items-center gap-4 px-5 py-3.5"
      style={{
        borderTop: isFirst ? "none" : "1px solid var(--hairline)",
      }}
    >
      <Link
        href={`/profile/${p.id}`}
        className="flex flex-1 items-center gap-4"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <Avatar src={p.profilePhotoUrl} name={fullName} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="display" style={{ fontSize: 17, fontWeight: 500 }}>
              {fullName}
            </div>
          </div>
          <div className="muted mt-0.5" style={{ fontSize: 12 }}>
            {p.roleType}
            {p.city || p.state ? ` · ${[p.city, p.state].filter(Boolean).join(", ")}` : ""}
          </div>
        </div>
        {ls ? (
          <div
            className="hidden sm:block"
            style={{ fontSize: 13, color: "var(--ink-3)", fontFamily: "var(--font-display)" }}
          >
            {ls}
          </div>
        ) : null}
        <Icon name="chevronRight" size={16} className="muted" />
      </Link>
      {showDelete ? (
        <div className="ml-2">
          {confirmDeleteId === p.id ? (
            <ConfirmDialog
              onConfirm={() => onDelete(p.id)}
              onCancel={() => setConfirmDeleteId(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(p.id)}
              aria-label={`Delete ${fullName}`}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: "transparent",
                border: "1px solid var(--hairline-strong)",
                color: "var(--ink-3)",
              }}
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
