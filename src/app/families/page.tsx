"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import type { Family } from "@/models/Family";
import AddFamilyModal from "@/components/AddFamilyModal";
import { deleteFamily, listFamilies } from "@/lib/db";
import ProtectedRoute from "@/components/ProtectedRoute";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { Button, Icon } from "@/components/ui";
import { formatDate } from "@/utils/dates";

const PAGE_SIZE = 24;

export default function FamiliesPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchFamilies = async (pageNum = 1, replace = true) => {
    try {
      const result = await listFamilies({
        page: pageNum,
        pageSize: PAGE_SIZE,
        paginate: true,
      });
      setFamilies((prev) => (replace ? result.data : [...prev, ...result.data]));
      setTotal(result.total);
      setPage(pageNum);
    } catch (err: unknown) {
      console.error(err);
      setError("Unable to load families.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  const hasMore = total !== null && families.length < total;

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchFamilies(page + 1, false);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-5xl px-6 py-12 md:px-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} className="h-36" />
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
        style={{ background: "var(--paper)", color: "var(--ink)", maxWidth: 1200 }}
      >
        <div
          className="mb-8 flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              Branches of the family
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
              Families
            </h1>
            {total !== null ? (
              <p className="muted mt-1.5" style={{ fontSize: 14 }}>
                {total} {total === 1 ? "family" : "families"} on the page
              </p>
            ) : null}
          </div>
          <Button variant="primary" icon="plus" onClick={() => setShowAddModal(true)}>
            Add family
          </Button>
        </div>

        {families.length === 0 ? (
          <div
            className="rounded-lg p-12 text-center"
            style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
          >
            <p className="display-italic muted" style={{ fontSize: 22, margin: 0 }}>
              No families yet.
            </p>
            <p className="muted mt-2" style={{ fontSize: 14 }}>
              Create a family to group related people together.
            </p>
            <div className="mt-5">
              <Button variant="primary" icon="plus" onClick={() => setShowAddModal(true)}>
                Add family
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {families.map((f) => {
                const isOwner = user?.id === f.createdBy;
                return (
                  <li key={f.id} className="relative">
                    <Link
                      href={`/families/${f.id}`}
                      className="flex h-full flex-col justify-between rounded-md p-5 transition-colors"
                      style={{
                        background: "var(--paper)",
                        border: "1px solid var(--hairline)",
                        textDecoration: "none",
                        color: "var(--ink)",
                      }}
                    >
                      <div>
                        <h2
                          className="display m-0 pr-10"
                          style={{ fontSize: 22, fontWeight: 500 }}
                        >
                          {f.name}
                        </h2>
                        {f.origin ? (
                          <p className="display-italic muted mt-2" style={{ fontSize: 13 }}>
                            from {f.origin}
                          </p>
                        ) : null}
                        {f.description ? (
                          <p
                            className="mt-3 line-clamp-3"
                            style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}
                          >
                            {f.description}
                          </p>
                        ) : null}
                      </div>

                      <div
                        className="muted mt-4 flex items-center justify-between"
                        style={{ fontSize: 12 }}
                      >
                        <span>Created {formatDate(f.createdAt)}</span>
                        {f.members ? (
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>
                            {f.members.length} {f.members.length === 1 ? "member" : "members"}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                    {isOwner ? (
                      <div className="absolute right-3 top-3">
                        {confirmDeleteId === f.id ? (
                          <ConfirmDialog
                            onConfirm={async () => {
                              await deleteFamily(f.id);
                              setConfirmDeleteId(null);
                              fetchFamilies();
                            }}
                            onCancel={() => setConfirmDeleteId(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setConfirmDeleteId(f.id);
                            }}
                            aria-label={`Delete ${f.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full"
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
          <AddFamilyModal
            onClose={() => setShowAddModal(false)}
            onCreated={fetchFamilies}
          />
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
