"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Family } from "@/models/Family";
import type { Person } from "@/models/Person";
import FamilyTreeView from "@/components/FamilyTreeView";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/utils/dates";
import { downloadGedcom } from "@/utils/gedcom";
import { Avatar, Button, Icon } from "@/components/ui";

export default function FamilyPage() {
  const params = useParams();
  const familyId = params?.id as string;

  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyInviteLink = useCallback(() => {
    const url = `${window.location.origin}/signup?family=${familyId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [familyId]);

  useEffect(() => {
    const fetchFamily = async () => {
      try {
        const { data, error: familyError } = await supabase
          .from("families")
          .select("*")
          .eq("id", familyId)
          .is("deletedAt", null)
          .single();
        if (familyError) throw familyError;
        const fetchedFamily = data as Family;
        setFamily(fetchedFamily);
        if (!fetchedFamily.members?.length) {
          setMembers([]);
          return;
        }
        const { data: peopleData, error: peopleError } = await supabase
          .from("people")
          .select("*")
          .in("id", fetchedFamily.members)
          .is("deletedAt", null);
        if (peopleError) throw peopleError;
        setMembers((peopleData ?? []) as Person[]);
      } catch (err: unknown) {
        console.error(err);
        setError("Unable to load family data.");
      } finally {
        setLoading(false);
      }
    };
    fetchFamily();
  }, [familyId]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div
          className="display-italic muted"
          style={{ textAlign: "center", padding: "96px 24px", fontSize: 18 }}
        >
          Loading family…
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

  if (!family) {
    return (
      <ProtectedRoute>
        <div
          className="display-italic muted"
          style={{ textAlign: "center", padding: "96px 24px", fontSize: 18 }}
        >
          Family not found.
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div
        className="mx-auto px-6 pb-16 pt-10 md:px-12"
        style={{ background: "var(--paper)", color: "var(--ink)", maxWidth: 1100 }}
      >
        {/* Breadcrumb */}
        <div
          className="mb-6 flex items-center gap-2"
          style={{ fontSize: 13, color: "var(--ink-3)" }}
        >
          <Link href="/families" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
            Families
          </Link>
          <Icon name="chevronRight" size={12} />
          <span style={{ color: "var(--ink-2)" }}>{family.name}</span>
        </div>

        {/* Header */}
        <header
          className="mb-10 flex flex-col gap-5 pb-7 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              A branch of the family
            </p>
            <h1
              className="display"
              style={{
                fontSize: "clamp(40px, 6vw, 60px)",
                margin: 0,
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              {family.name}
            </h1>
            {family.description ? (
              <p
                className="mt-4"
                style={{ fontSize: 17, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 620 }}
              >
                {family.description}
              </p>
            ) : null}
            <div className="muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontSize: 13 }}>
              {family.origin ? (
                <span className="display-italic" style={{ fontSize: 14 }}>
                  from {family.origin}
                </span>
              ) : null}
              {family.origin ? (
                <span
                  aria-hidden="true"
                  style={{ width: 4, height: 4, borderRadius: 999, background: "var(--hairline-strong)" }}
                />
              ) : null}
              <span>Created {formatDate(family.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="people" onClick={copyInviteLink}>
              {copied ? "Link copied" : "Invite family"}
            </Button>
            <Button
              variant="ghost"
              icon="arrow"
              onClick={() => downloadGedcom(members, [family], `${family.name || "family"}-tree.ged`)}
            >
              Export GEDCOM
            </Button>
          </div>
        </header>

        {/* Members */}
        <section className="mb-12">
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            The page
          </p>
          <h2
            className="display mb-6 m-0"
            style={{ fontSize: 28, fontWeight: 500, color: "var(--ink)" }}
          >
            <span className="display-italic">{members.length} </span>
            {members.length === 1 ? "member" : "members"}
          </h2>
          {members.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              No members yet.
            </p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 md:grid-cols-3">
              {members.map((p) => {
                const fullName = `${p.firstName} ${p.lastName}`;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/profile/${p.id}`}
                      className="flex items-center gap-3 rounded-md p-3 transition-colors"
                      style={{
                        background: "var(--paper)",
                        border: "1px solid var(--hairline)",
                        textDecoration: "none",
                        color: "var(--ink)",
                      }}
                    >
                      <Avatar src={p.profilePhotoUrl} name={fullName} size={48} />
                      <div className="min-w-0">
                        <div
                          className="display"
                          style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}
                        >
                          {p.firstName}{" "}
                          <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>
                            {p.lastName}
                          </span>
                        </div>
                        {p.roleType ? (
                          <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                            {p.roleType}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tree */}
        <section>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            The constellation
          </p>
          <h2
            className="display mb-6 m-0"
            style={{ fontSize: 28, fontWeight: 500, color: "var(--ink)" }}
          >
            <span className="display-italic">Family tree</span>
          </h2>
          <div
            className="paper-grain overflow-hidden rounded-md"
            style={{ background: "var(--paper)", border: "1px solid var(--hairline)" }}
          >
            <FamilyTreeView familyId={family.id} />
          </div>
        </section>

        <div className="mt-10 text-right">
          <Link
            href="/family-tree"
            style={{ color: "var(--sage-deep)", textDecoration: "none", fontSize: 14 }}
          >
            ← Back to people
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}
