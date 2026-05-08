"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  getPersonById,
  listEventsForPerson,
  listFamiliesForPerson,
  listMemoriesForPerson,
  listPeople,
  listPeopleByIds,
  listRelationshipsForPerson,
  savePerson,
  unlinkParentChild,
  unlinkSpouses,
  updatePerson,
} from "@/lib/db";
import { uploadProfilePhoto } from "@/lib/storage";
import { useAuth } from "@/components/AuthProvider";
import { toDisplayImageUrl } from "@/utils/imageUrl";
import AddFamilyModal from "@/components/AddFamilyModal";
import AddMemberModal from "@/components/AddMemberModal";
import AddMemoryModal from "@/components/AddMemoryModal";
import ProfileEditForm from "@/components/ProfileEditForm";
import { Avatar, Button, Chip, Icon, PhotoFrame } from "@/components/ui";
import type { Event } from "@/models/Event";
import type { Family } from "@/models/Family";
import type { Memory } from "@/models/Memory";
import type { Person } from "@/models/Person";
import type { Relationship } from "@/models/Relationship";
import { convertHeicToJpeg, isHeicFile, isHeicFileByMagic } from "@/utils/heic";
import { formatDate } from "@/utils/dates";
import { getErrorMessage } from "@/utils/errorMessage";
import { findRelationship } from "@/utils/relationship";

function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function yearOf(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})/);
  return m ? m[1] : null;
}

function formatLifespan(person: Person): string | null {
  const birth = yearOf(person.birthDate);
  const death = yearOf(person.deathDate);
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return null;
}

function joinPlace(...parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(", ");
}

const obituaryKeywords = ["obituary", "obituaries", "legacy", "memorial"];

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileLoading() {
  return (
    <ProtectedRoute>
      <div
        className="display-italic muted"
        style={{ textAlign: "center", padding: "96px 24px", fontSize: 18 }}
      >
        Loading profile…
      </div>
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const personId = params?.id as string;

  const [person, setPerson] = useState<Person | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [personFamilies, setPersonFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [claimCopied, setClaimCopied] = useState(false);
  const [form, setForm] = useState<Partial<Person>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoPreviewBlobRef = useRef<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showDeceased, setShowDeceased] = useState(false);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (searchParams.get("edit") === "true") setEditing(true);
  }, [searchParams]);

  const refreshMemories = useCallback(async () => {
    const mems = await listMemoriesForPerson(personId);
    setMemories(mems);
  }, [personId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const p = await getPersonById(personId);
        setPerson(p);
        setForm(p ?? {});
        if (p?.deathDate) setShowDeceased(true);
        const [related, personMemories, families, rels, peopleList] = await Promise.all([
          listEventsForPerson(personId),
          listMemoriesForPerson(personId),
          listFamiliesForPerson(personId),
          listRelationshipsForPerson(personId).catch(() => [] as Relationship[]),
          listPeople().catch(() => [] as Person[]),
        ]);
        setEvents(related);
        setMemories(personMemories);
        setPersonFamilies(families);
        setRelationships(rels);
        setAllPeople(peopleList);
      } catch (err: unknown) {
        console.error(err);
        setError("Unable to load profile data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [personId]);

  // Revoke any outstanding preview blob URL when the profile unmounts.
  useEffect(() => {
    return () => {
      if (photoPreviewBlobRef.current) {
        URL.revokeObjectURL(photoPreviewBlobRef.current);
        photoPreviewBlobRef.current = null;
      }
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    try {
      if (person) {
        const updates = { ...form, updatedAt: now };
        await updatePerson(person.id, updates);
        setPerson((prev) => (prev ? { ...prev, ...updates } : prev));
      }
      if (!person) {
        const newId = personId || uuidv4();
        const newPerson: Person = {
          id: newId,
          firstName: form.firstName || "",
          lastName: form.lastName || "",
          roleType: (form.roleType as Person["roleType"]) || "family member",
          email: form.email || "",
          phone: form.phone || "",
          address: form.address || "",
          city: form.city || "",
          state: form.state || "",
          country: form.country || "",
          birthDate: form.birthDate || "",
          deathDate: form.deathDate || "",
          bio: form.bio || "",
          createdBy: user.id,
          createdAt: now,
        };
        await savePerson(newPerson);
        setPerson(newPerson);
        setForm(newPerson);
        router.push(`/profile/${newId}`);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Error saving profile."));
    }
    setEditing(false);
  };

  const revokePreviewBlob = () => {
    if (photoPreviewBlobRef.current) {
      URL.revokeObjectURL(photoPreviewBlobRef.current);
      photoPreviewBlobRef.current = null;
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file || !user) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      let uploadFile = file;
      const needsConversion = isHeicFile(file) || (await isHeicFileByMagic(file));
      if (needsConversion) {
        uploadFile = await convertHeicToJpeg(file);
      }
      revokePreviewBlob();
      const blobUrl = URL.createObjectURL(uploadFile);
      photoPreviewBlobRef.current = blobUrl;
      setPhotoPreview(blobUrl);
      const url = await uploadProfilePhoto(user.id, personId, uploadFile);
      setPhotoPreview(url);
      revokePreviewBlob();
      await updatePerson(personId, { profilePhotoUrl: url });
      setPerson((prev) => (prev ? { ...prev, profilePhotoUrl: url } : prev));
    } catch (err: unknown) {
      console.error(err);
      setPhotoError(
        "Photo upload failed. If this is a HEIC image, conversion may have failed. Please try again.",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const refreshPerson = async () => {
    const p = await getPersonById(personId);
    if (p) {
      setPerson(p);
      setForm(p);
    }
    const rels = await listRelationshipsForPerson(personId).catch(
      () => [] as Relationship[],
    );
    setRelationships(rels);
  };

  const handleRemoveParent = async (parentId: string) => {
    await unlinkParentChild(parentId, personId);
    await refreshPerson();
  };

  const handleRemoveChild = async (childId: string) => {
    await unlinkParentChild(personId, childId);
    await refreshPerson();
  };

  const handleRemoveSpouse = async (spouseId: string) => {
    await unlinkSpouses(personId, spouseId);
    await refreshPerson();
  };

  const handleCopyClaim = () => {
    if (!person) return;
    const url = `${window.location.origin}/signup?claim=${person.id}${
      person.familyIds?.[0] ? `&family=${person.familyIds[0]}` : ""
    }`;
    navigator.clipboard.writeText(url);
    setClaimCopied(true);
    setTimeout(() => setClaimCopied(false), 2000);
  };

  // "Your relationship" chip: derive how the viewing user is related to the
  // displayed person. Hidden when viewing your own profile, when there's no
  // signed-in person record, or when the two have no traceable connection.
  const relationshipToViewer = useMemo(() => {
    if (!user || !person) return null;
    const me = allPeople.find((p) => p.userId === user.id) ?? null;
    if (!me || me.id === person.id) return null;
    const peopleById = new Map<string, Person>();
    for (const p of allPeople) peopleById.set(p.id, p);
    if (!peopleById.has(person.id)) peopleById.set(person.id, person);
    return findRelationship(me.id, person.id, peopleById);
  }, [allPeople, person, user]);

  if (loading) return <ProfileLoading />;

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

  if (!person) {
    return (
      <ProtectedRoute>
        <div
          className="display-italic muted"
          style={{ textAlign: "center", padding: "96px 24px", fontSize: 18 }}
        >
          Person not found.
        </div>
      </ProtectedRoute>
    );
  }

  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const lifespan = formatLifespan(person);
  const birthplace = person.birthPlace || joinPlace(person.city, person.state, person.country);
  const livesIn = person.deathDate ? null : joinPlace(person.city, person.state, person.country);
  const obituary = person.websiteUrl
    ? obituaryKeywords.some((k) => person.websiteUrl!.toLowerCase().includes(k))
    : false;
  const bioParagraphs = (person.bio ?? "").split(/\n\s*\n/).filter((s) => s.trim().length > 0);
  const photoSrc = photoPreview ?? person.profilePhotoUrl ?? null;

  return (
    <ProtectedRoute>
      <article style={{ background: "var(--paper)", color: "var(--ink)", paddingBottom: 64 }}>
        {/* Breadcrumb bar */}
        <div
          className="flex items-center gap-2 px-6 pt-5 md:px-16"
          style={{ fontSize: 13, color: "var(--ink-3)" }}
        >
          <Link
            href="/family-tree"
            style={{ color: "var(--ink-3)", textDecoration: "none" }}
          >
            People
          </Link>
          <Icon name="chevronRight" size={12} />
          <span style={{ color: "var(--ink-2)" }}>{fullName}</span>
          <div className="ml-auto flex gap-2">
            {!editing ? (
              <Button
                variant="ghost"
                size="sm"
                icon="pencil"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon="close"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Memorial banner — soft, not loud */}
        {person.deathDate ? (
          <div
            className="display-italic mx-6 mt-4 rounded-md px-4 py-3 text-center md:mx-16"
            style={{
              background: "var(--paper-2)",
              border: "1px solid var(--hairline)",
              color: "var(--ink-2)",
              fontSize: 14,
            }}
          >
            In loving memory of {fullName}
          </div>
        ) : null}

        {editing ? (
          <EditPanel
            form={form}
            person={person}
            showDeceased={showDeceased}
            photoSrc={photoSrc}
            photoUploading={photoUploading}
            photoError={photoError}
            onChange={handleChange}
            onShowDeceasedChange={setShowDeceased}
            onFormUpdate={setForm}
            onSave={handleSave}
            onPhotoUpload={handlePhotoUpload}
            onRemoveParent={handleRemoveParent}
            onRemoveSpouse={handleRemoveSpouse}
            onRemoveChild={handleRemoveChild}
            onAddFamilyMember={() => setShowFamilyModal(true)}
            onAddToFamily={() => setShowAddFamilyModal(true)}
          />
        ) : (
          <>
            <Hero
              person={person}
              photoSrc={photoSrc}
              onUploadPhoto={handlePhotoUpload}
              uploading={photoUploading}
              uploadError={photoError}
              lifespan={lifespan}
              birthplace={birthplace}
              livesIn={livesIn}
              fullName={fullName}
              onAddMemory={() => setShowMemoryModal(true)}
              onCopyClaim={handleCopyClaim}
              claimCopied={claimCopied}
              canClaim={!person.userId}
            />

            {relationshipToViewer ? (
              <div
                className="px-6 md:px-16"
                aria-label={`Your relationship to ${person.firstName}: ${relationshipToViewer.label}`}
              >
                <Chip tone="sage">Your {relationshipToViewer.label}</Chip>
              </div>
            ) : null}

            <VitalsAndConstellation
              person={person}
              relationships={relationships}
              personFamilies={personFamilies}
              obituary={obituary}
            />

            {bioParagraphs.length > 0 ? <Biography paragraphs={bioParagraphs} /> : null}

            {events.length > 0 ? <LifeEventsSection events={events} /> : null}

            <PhotoGallerySection
              memories={memories}
              firstName={person.firstName}
              onAddMemory={() => setShowMemoryModal(true)}
            />

            <Colophon updatedAt={person.updatedAt ?? person.createdAt} />
          </>
        )}
      </article>

      {showFamilyModal ? (
        <AddMemberModal
          onClose={() => setShowFamilyModal(false)}
          currentPersonId={person.id}
          onLinked={refreshPerson}
        />
      ) : null}
      {showAddFamilyModal ? (
        <AddFamilyModal
          onClose={() => setShowAddFamilyModal(false)}
          currentPersonId={person.id}
          onCreated={async () => {
            const families = await listFamiliesForPerson(personId);
            setPersonFamilies(families);
          }}
        />
      ) : null}
      {showMemoryModal ? (
        <AddMemoryModal
          onClose={() => setShowMemoryModal(false)}
          onCreated={refreshMemories}
          preTaggedPersonId={person.id}
        />
      ) : null}
    </ProtectedRoute>
  );
}

// =============================================================================
// Hero — name, photo, lede
// =============================================================================
type HeroProps = {
  person: Person;
  photoSrc: string | null;
  onUploadPhoto: (file: File) => void;
  uploading: boolean;
  uploadError: string | null;
  lifespan: string | null;
  birthplace: string;
  livesIn: string | null;
  fullName: string;
  onAddMemory: () => void;
  onCopyClaim: () => void;
  claimCopied: boolean;
  canClaim: boolean;
};

function Hero({
  person,
  photoSrc,
  onUploadPhoto,
  uploading,
  uploadError,
  lifespan,
  birthplace,
  livesIn,
  fullName,
  onAddMemory,
  onCopyClaim,
  claimCopied,
  canClaim,
}: HeroProps) {
  const facts: string[] = [];
  if (lifespan) facts.push(lifespan);
  const placeArrow = birthplace && livesIn && birthplace !== livesIn ? `${birthplace} → ${livesIn}` : (livesIn || birthplace);
  if (placeArrow) facts.push(placeArrow);

  return (
    <header
      className="grid items-end gap-10 px-6 pb-14 pt-12 md:grid-cols-[minmax(0,1fr)_360px] md:px-16 md:pt-12 lg:gap-14 lg:md:grid-cols-[minmax(0,1fr)_440px]"
      style={{ borderBottom: "1px solid var(--hairline)" }}
    >
      <div>
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          {person.roleType}
        </p>
        <h1
          className="display"
          style={{
            fontSize: "clamp(56px, 9vw, 108px)",
            margin: 0,
            fontWeight: 400,
            lineHeight: 0.92,
            letterSpacing: "-0.035em",
          }}
        >
          {person.firstName}
          {person.middleName ? (
            <>
              {" "}
              <span className="display-italic" style={{ color: "var(--sage-deep)" }}>
                {person.middleName}
              </span>
            </>
          ) : null}
        </h1>
        {person.lastName ? (
          <h1
            className="display"
            style={{
              fontSize: "clamp(56px, 9vw, 108px)",
              margin: 0,
              fontWeight: 400,
              lineHeight: 0.92,
              letterSpacing: "-0.035em",
            }}
          >
            {person.lastName}
          </h1>
        ) : null}

        {facts.length > 0 ? (
          <div
            className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)" }}
          >
            {facts.map((f, i) => (
              <span key={f} className="flex items-center gap-4">
                {i > 0 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 999,
                      background: "var(--hairline-strong)",
                    }}
                  />
                ) : null}
                <span>{f}</span>
              </span>
            ))}
          </div>
        ) : null}

        {person.bio ? (
          <p
            className="mt-7"
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              maxWidth: 560,
              color: "var(--ink-2)",
            }}
          >
            {person.bio.split(/\n\s*\n/)[0]}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-2">
          <Button variant="quiet" size="sm" icon="memory" onClick={onAddMemory}>
            Add memory
          </Button>
          {canClaim ? (
            <Button variant="ghost" size="sm" icon="arrow" onClick={onCopyClaim}>
              {claimCopied ? "Link copied" : "Invite to claim"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative">
        <PhotoFrame
          src={photoSrc}
          alt={fullName}
          ratio="4 / 5"
          rounded={2}
          frame
          label={`${person.firstName}'s portrait`}
        />
        <p
          className="display-italic muted"
          style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}
        >
          Portrait
        </p>

        {/* Photo upload affordance — small pencil button overlay */}
        <label
          className="absolute right-2 top-2 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            color: "var(--ink)",
            boxShadow: "var(--shadow-sm)",
            opacity: uploading ? 0.6 : 1,
          }}
          aria-label={uploading ? "Uploading photo" : "Replace portrait"}
        >
          <Icon name={uploading ? "clock" : "pencil"} size={14} />
          <input
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadPhoto(file);
            }}
          />
        </label>

        {uploadError ? (
          <p
            className="mt-3 text-center"
            style={{ color: "var(--clay-deep)", fontSize: 13 }}
          >
            {uploadError}
          </p>
        ) : null}
      </div>
    </header>
  );
}

// =============================================================================
// Vital details + family constellation
// =============================================================================
type VitalsProps = {
  person: Person;
  relationships: Relationship[];
  personFamilies: Family[];
  obituary: boolean;
};

type Fact = { k: string; v: string };

function VitalsAndConstellation({ person, personFamilies, obituary }: VitalsProps) {
  const facts: Fact[] = [];
  if (person.birthDate) facts.push({ k: "Born", v: formatDate(person.birthDate) });
  if (person.birthPlace) facts.push({ k: "Birthplace", v: person.birthPlace });
  const livesIn = person.deathDate ? null : joinPlace(person.city, person.state, person.country);
  if (livesIn) facts.push({ k: "Lives in", v: livesIn });
  if (person.deathDate) facts.push({ k: "Passed", v: formatDate(person.deathDate) });
  if (person.deathPlace) facts.push({ k: "Death place", v: person.deathPlace });
  if (person.email) facts.push({ k: "Email", v: person.email });
  if (person.phone) facts.push({ k: "Phone", v: person.phone });
  if (personFamilies.length > 0) {
    facts.push({ k: "Family groups", v: personFamilies.map((f) => f.name).join(", ") });
  }

  return (
    <section
      className="grid gap-8 px-6 py-14 md:grid-cols-[320px_1fr] md:gap-16 md:px-16"
    >
      <div>
        <p className="eyebrow" style={{ marginBottom: 18 }}>
          Vital details
        </p>
        {facts.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>
            No details on record yet.
          </p>
        ) : (
          <dl
            className="m-0 grid"
            style={{ gridTemplateColumns: "auto 1fr", rowGap: 14, columnGap: 20 }}
          >
            {facts.map((f) => (
              <div key={f.k} style={{ display: "contents" }}>
                <dt
                  className="muted"
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    paddingTop: 3,
                  }}
                >
                  {f.k}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontSize: 16,
                    color: "var(--ink)",
                  }}
                >
                  {f.v}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {(person.facebookUrl || person.websiteUrl) ? (
          <div className="mt-6">
            <p className="eyebrow" style={{ marginBottom: 10 }}>
              Links
            </p>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {person.facebookUrl ? (
                <li>
                  <a
                    href={ensureProtocol(person.facebookUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--sage-deep)", fontSize: 14 }}
                  >
                    Facebook profile
                  </a>
                </li>
              ) : null}
              {person.websiteUrl ? (
                <li>
                  <a
                    href={ensureProtocol(person.websiteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--sage-deep)", fontSize: 14 }}
                  >
                    {obituary ? "Obituary" : "Website"}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 18 }}>
          The people around them
        </p>
        <FamilyConstellation
          parentIds={person.parentIds ?? []}
          spouseIds={person.spouseIds ?? []}
          childIds={person.childIds ?? []}
          firstName={person.firstName}
        />
      </div>
    </section>
  );
}

type ConstellationProps = {
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
  firstName: string;
};

function FamilyConstellation({ parentIds, spouseIds, childIds, firstName }: ConstellationProps) {
  const [parents, setParents] = useState<Person[]>([]);
  const [spouses, setSpouses] = useState<Person[]>([]);
  const [children, setChildren] = useState<Person[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      parentIds.length ? listPeopleByIds(parentIds) : Promise.resolve([] as Person[]),
      spouseIds.length ? listPeopleByIds(spouseIds) : Promise.resolve([] as Person[]),
      childIds.length ? listPeopleByIds(childIds) : Promise.resolve([] as Person[]),
    ])
      .then(([par, sp, ch]) => {
        if (cancelled) return;
        setParents(par);
        setSpouses(sp);
        setChildren(ch);
      })
      .catch((e) => console.error("Failed to load family constellation", e));
    return () => {
      cancelled = true;
    };
  }, [parentIds, spouseIds, childIds]);

  const total = parents.length + spouses.length + children.length;
  if (total === 0) {
    return (
      <p className="muted" style={{ fontSize: 14, maxWidth: 520 }}>
        No family connections yet. Add parents, a spouse, or children from the edit screen.
      </p>
    );
  }

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {spouses.length > 0 ? (
        <ConstellationColumn label="married to" people={spouses} firstName={firstName} />
      ) : null}
      {parents.length > 0 ? (
        <ConstellationColumn label="child of" people={parents} firstName={firstName} />
      ) : null}
      {children.length > 0 ? (
        <ConstellationColumn label="parent of" people={children} firstName={firstName} />
      ) : null}
    </div>
  );
}

function ConstellationColumn({
  label,
  people,
  firstName: _firstName,
}: {
  label: string;
  people: Person[];
  firstName: string;
}) {
  return (
    <div>
      <div className="display-italic muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {label}
      </div>
      <div className="flex flex-col gap-2.5">
        {people.map((p) => (
          <FamilyConstellationCard key={p.id} person={p} />
        ))}
      </div>
    </div>
  );
}

function FamilyConstellationCard({ person }: { person: Person }) {
  const lifespan = formatLifespan(person);
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return (
    <Link
      href={`/profile/${person.id}`}
      className="flex items-center gap-3 rounded-md p-1 transition-colors"
      style={{ textDecoration: "none", color: "var(--ink)" }}
    >
      <Avatar src={person.profilePhotoUrl} name={fullName} size={44} />
      <div style={{ minWidth: 0 }}>
        <div className="display" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.15 }}>
          {person.firstName}{" "}
          <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{person.lastName}</span>
        </div>
        {lifespan ? (
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            {lifespan}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

// =============================================================================
// Biography — long-scroll editorial column
// =============================================================================
function Biography({ paragraphs }: { paragraphs: string[] }) {
  return (
    <>
      <div style={{ height: 1, background: "var(--hairline)", margin: "0 64px" }} />
      <section className="px-6 py-16 md:px-16">
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          <p className="eyebrow" style={{ marginBottom: 8, textAlign: "center" }}>
            Biography
          </p>
          <h2
            className="display"
            style={{
              fontSize: 36,
              margin: "0 0 32px",
              fontWeight: 400,
              textAlign: "center",
              letterSpacing: "-0.02em",
            }}
          >
            <span className="display-italic">In their own thread</span>
          </h2>
          {paragraphs.map((para, i) => (
            <p
              key={i}
              style={{
                fontSize: 17,
                lineHeight: 1.7,
                color: "var(--ink-2)",
                margin: i === 0 ? "0" : "20px 0 0",
              }}
            >
              {para}
            </p>
          ))}
        </div>
      </section>
    </>
  );
}

// =============================================================================
// Life events
// =============================================================================
function LifeEventsSection({ events }: { events: Event[] }) {
  return (
    <section
      className="px-6 py-14 md:px-16"
      style={{ background: "var(--sage-tint)", borderTop: "1px solid var(--sage-soft)", borderBottom: "1px solid var(--sage-soft)" }}
    >
      <div className="mx-auto" style={{ maxWidth: 1040 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Life events
        </p>
        <h2
          className="display mb-8"
          style={{ fontSize: 32, margin: "0 0 32px", fontWeight: 400, letterSpacing: "-0.02em" }}
        >
          <span className="display-italic">Milestones, year by year</span>
        </h2>
        <ul className="m-0 list-none space-y-4 p-0">
          {events.map((e) => (
            <li
              key={e.id}
              className="rounded-md p-4"
              style={{ background: "var(--paper)", border: "1px solid var(--hairline)" }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  className="display m-0"
                  style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)" }}
                >
                  {e.title}
                </h3>
                <span
                  className="display"
                  style={{ fontSize: 14, color: "var(--ink-3)", whiteSpace: "nowrap" }}
                >
                  {formatDate(e.date)}
                </span>
              </div>
              <div className="mt-1.5">
                <Chip tone={e.type === "memory" ? "sage" : "default"}>{e.type}</Chip>
              </div>
              {e.description ? (
                <p
                  className="mt-3"
                  style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}
                >
                  {e.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// =============================================================================
// Photo gallery — 12-col grid
// =============================================================================
function PhotoGallerySection({
  memories,
  firstName,
  onAddMemory,
}: {
  memories: Memory[];
  firstName: string;
  onAddMemory: () => void;
}) {
  const withPhotos = memories.filter((m) => m.imageUrls && m.imageUrls.length > 0);
  const count = memories.length;

  return (
    <section className="px-6 pt-16 md:px-16">
      <div
        className="mb-8 flex items-baseline justify-between gap-4 pb-5"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <div>
          <p className="eyebrow">Photographs &amp; stories</p>
          <h2
            className="display"
            style={{ fontSize: 32, margin: "6px 0 0", fontWeight: 400 }}
          >
            In the frame{count > 0 ? ` · ${count} ${count === 1 ? "memory" : "memories"}` : ""}
          </h2>
        </div>
        <Button variant="quiet" size="sm" icon="plus" onClick={onAddMemory}>
          Add memory
        </Button>
      </div>

      {withPhotos.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          No memories tagged yet. Share a photo or story about {firstName}.
        </p>
      ) : (
        <GalleryGrid memories={withPhotos.slice(0, 8)} />
      )}
    </section>
  );
}

function GalleryGrid({ memories }: { memories: Memory[] }) {
  // Hero photo (first), the rest in a flexible mosaic
  const [hero, ...rest] = memories;
  const heroSrc = toDisplayImageUrl(hero.imageUrls?.[0]) || null;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <figure className="m-0 lg:col-span-5">
        <PhotoFrame src={heroSrc} alt={hero.title} ratio="4 / 5" rounded={2} />
        <figcaption className="display-italic muted mt-2" style={{ fontSize: 12 }}>
          {hero.title}
          {hero.date ? <> · {formatDate(hero.date)}</> : null}
        </figcaption>
      </figure>
      <div className="grid grid-cols-2 gap-3 lg:col-span-7">
        {rest.map((m) => {
          const src = toDisplayImageUrl(m.imageUrls?.[0]) || null;
          return (
            <figure key={m.id} className="m-0">
              <PhotoFrame src={src} alt={m.title} ratio="4 / 3" rounded={2} />
              <figcaption
                className="display-italic muted mt-2"
                style={{ fontSize: 12 }}
              >
                {m.title}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Colophon — quiet footer
// =============================================================================
function Colophon({ updatedAt }: { updatedAt: string | undefined }) {
  const updated = updatedAt ? new Date(updatedAt) : null;
  const updatedLabel = updated
    ? updated.toLocaleString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <section className="px-6 pb-4 pt-16 text-center md:px-16">
      <div className="mb-3.5 flex items-center justify-center gap-5">
        <span style={{ width: 40, height: 1, background: "var(--hairline-strong)" }} />
        <Icon name="sparkle" size={14} style={{ color: "var(--sage-deep)" }} />
        <span style={{ width: 40, height: 1, background: "var(--hairline-strong)" }} />
      </div>
      {updatedLabel ? (
        <p className="display-italic muted" style={{ fontSize: 14, margin: 0 }}>
          Last updated {updatedLabel}.
        </p>
      ) : null}
    </section>
  );
}

// =============================================================================
// Edit panel — wraps existing ProfileEditForm in the new visual chrome
// =============================================================================
type EditPanelProps = {
  form: Partial<Person>;
  person: Person;
  showDeceased: boolean;
  photoSrc: string | null;
  photoUploading: boolean;
  photoError: string | null;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  onShowDeceasedChange: (v: boolean) => void;
  onFormUpdate: React.Dispatch<React.SetStateAction<Partial<Person>>>;
  onSave: () => void;
  onPhotoUpload: (file: File) => void;
  onRemoveParent: (id: string) => void;
  onRemoveSpouse: (id: string) => void;
  onRemoveChild: (id: string) => void;
  onAddFamilyMember: () => void;
  onAddToFamily: () => void;
};

function EditPanel({
  form,
  person,
  showDeceased,
  photoSrc,
  photoUploading,
  photoError,
  onChange,
  onShowDeceasedChange,
  onFormUpdate,
  onSave,
  onPhotoUpload,
  onRemoveParent,
  onRemoveSpouse,
  onRemoveChild,
  onAddFamilyMember,
  onAddToFamily,
}: EditPanelProps) {
  return (
    <section className="px-6 py-12 md:px-16">
      <div
        className="mx-auto rounded-lg p-6 md:p-10"
        style={{
          maxWidth: 880,
          background: "var(--paper-2)",
          border: "1px solid var(--hairline)",
        }}
      >
        <div className="mb-8 flex items-start gap-6">
          <div className="relative">
            <Avatar
              src={photoSrc}
              name={`${person.firstName} ${person.lastName}`}
              size={88}
            />
            <label
              className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline-strong)",
                color: "var(--ink)",
                boxShadow: "var(--shadow-sm)",
                opacity: photoUploading ? 0.6 : 1,
              }}
              aria-label={photoUploading ? "Uploading photo" : "Replace portrait"}
            >
              <Icon name={photoUploading ? "clock" : "pencil"} size={12} />
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                disabled={photoUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPhotoUpload(file);
                }}
              />
            </label>
          </div>
          <div>
            <p className="eyebrow">Editing profile</p>
            <h2
              className="display m-0"
              style={{ fontSize: 30, fontWeight: 500, marginTop: 4 }}
            >
              {person.firstName}{" "}
              {person.middleName ? (
                <span className="display-italic" style={{ color: "var(--sage-deep)" }}>
                  {person.middleName}{" "}
                </span>
              ) : null}
              {person.lastName}
            </h2>
            {photoError ? (
              <p className="mt-2" style={{ color: "var(--clay-deep)", fontSize: 13 }}>
                {photoError}
              </p>
            ) : null}
          </div>
        </div>

        <ProfileEditForm
          form={form}
          person={person}
          showDeceased={showDeceased}
          onChange={onChange}
          onShowDeceasedChange={onShowDeceasedChange}
          onFormUpdate={onFormUpdate}
          onSave={onSave}
          onRemoveParent={onRemoveParent}
          onRemoveSpouse={onRemoveSpouse}
          onRemoveChild={onRemoveChild}
          onAddFamilyMember={onAddFamilyMember}
          onAddToFamily={onAddToFamily}
        />
      </div>
    </section>
  );
}
