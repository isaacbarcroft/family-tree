// Pure functions used by the /api/notifications/digest worker. Kept free of
// Supabase / Resend / Next imports so the logic can be unit-tested in
// isolation.

export type DigestFrequency = "off" | "daily" | "weekly"

export interface NotificationPrefs {
  digest: DigestFrequency
  reactions: boolean
  comments: boolean
}

export interface DigestReactionRow {
  memoryId: string
  userId: string
  emoji: string
  createdAt: string
}

export interface DigestCommentRow {
  memoryId: string
  userId: string
  body: string
  createdAt: string
}

export interface DigestMemoryRow {
  id: string
  title: string
  createdBy: string
}

export interface DigestRecipient {
  userId: string
  email: string
  prefs: NotificationPrefs
  unsubscribeToken: string
  lastDigestSentAt: string | null
  createdAt: string
}

export interface DigestActorName {
  userId: string
  displayName: string
}

export interface DigestEntry {
  memoryId: string
  memoryTitle: string
  reactionCount: number
  commentCount: number
  actorNames: string[]
}

export interface DigestForRecipient {
  recipient: DigestRecipient
  entries: DigestEntry[]
  totalReactions: number
  totalComments: number
}

const DEFAULT_PREFS: NotificationPrefs = {
  digest: "weekly",
  reactions: true,
  comments: true,
}

export function normalizePrefs(raw: unknown): NotificationPrefs {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PREFS }

  const obj = raw as Record<string, unknown>
  const digestRaw = obj.digest
  const digest: DigestFrequency =
    digestRaw === "off" || digestRaw === "daily" || digestRaw === "weekly"
      ? digestRaw
      : DEFAULT_PREFS.digest

  const reactions =
    typeof obj.reactions === "boolean" ? obj.reactions : DEFAULT_PREFS.reactions
  const comments =
    typeof obj.comments === "boolean" ? obj.comments : DEFAULT_PREFS.comments

  return { digest, reactions, comments }
}

// A recipient should be picked up on `now` when:
//   - prefs.digest is not "off"
//   - prefs.digest === "daily"  -> at least 1 day since last send (or never)
//   - prefs.digest === "weekly" -> at least 7 days since last send (or never)
//
// "since last send" uses lastDigestSentAt; if null, we use the recipient's
// createdAt so brand-new accounts get their first digest one cycle after
// signup, not immediately.
export function isDigestDue(recipient: DigestRecipient, now: Date): boolean {
  if (recipient.prefs.digest === "off") return false

  const referenceIso = recipient.lastDigestSentAt ?? recipient.createdAt
  const reference = new Date(referenceIso).getTime()
  if (Number.isNaN(reference)) return true

  const elapsedMs = now.getTime() - reference
  if (recipient.prefs.digest === "daily") {
    return elapsedMs >= 24 * 60 * 60 * 1000
  }
  return elapsedMs >= 7 * 24 * 60 * 60 * 1000
}

// `since` is "createdAt of the row" must be strictly after this ISO.
function isAfter(rowCreatedAt: string, sinceIso: string | null): boolean {
  if (!sinceIso) return true
  return new Date(rowCreatedAt).getTime() > new Date(sinceIso).getTime()
}

// Group raw activity into per-recipient digests. Drops:
//   - activity that pre-dates the recipient's lastDigestSentAt (so a daily
//     digest doesn't include rows already shipped in yesterday's email)
//   - reactions / comments authored by the recipient themselves
//   - rows whose memory the recipient did not create (we only notify the
//     memory owner about activity on their memory)
//   - reactions when prefs.reactions === false
//   - comments  when prefs.comments  === false
//
// Returns one DigestForRecipient per recipient with at least one entry. If a
// recipient has zero qualifying rows, they're omitted entirely (no empty
// emails).
export function buildDigests(input: {
  recipients: DigestRecipient[]
  memories: DigestMemoryRow[]
  reactions: DigestReactionRow[]
  comments: DigestCommentRow[]
  actorNames: DigestActorName[]
  now: Date
}): DigestForRecipient[] {
  const memoriesById = new Map<string, DigestMemoryRow>()
  for (const m of input.memories) memoriesById.set(m.id, m)

  const namesById = new Map<string, string>()
  for (const a of input.actorNames) namesById.set(a.userId, a.displayName)

  const result: DigestForRecipient[] = []

  for (const recipient of input.recipients) {
    if (!isDigestDue(recipient, input.now)) continue

    const since = recipient.lastDigestSentAt
    const entriesByMemoryId = new Map<string, DigestEntry>()

    function ensureEntry(memoryId: string): DigestEntry | null {
      const existing = entriesByMemoryId.get(memoryId)
      if (existing) return existing
      const memory = memoriesById.get(memoryId)
      if (!memory) return null
      if (memory.createdBy !== recipient.userId) return null
      const entry: DigestEntry = {
        memoryId,
        memoryTitle: memory.title,
        reactionCount: 0,
        commentCount: 0,
        actorNames: [],
      }
      entriesByMemoryId.set(memoryId, entry)
      return entry
    }

    function addActor(entry: DigestEntry, userId: string) {
      const name = namesById.get(userId) ?? "A family member"
      if (entry.actorNames.includes(name)) return
      entry.actorNames.push(name)
    }

    if (recipient.prefs.reactions) {
      for (const r of input.reactions) {
        if (!isAfter(r.createdAt, since)) continue
        if (r.userId === recipient.userId) continue
        const entry = ensureEntry(r.memoryId)
        if (!entry) continue
        entry.reactionCount += 1
        addActor(entry, r.userId)
      }
    }

    if (recipient.prefs.comments) {
      for (const c of input.comments) {
        if (!isAfter(c.createdAt, since)) continue
        if (c.userId === recipient.userId) continue
        const entry = ensureEntry(c.memoryId)
        if (!entry) continue
        entry.commentCount += 1
        addActor(entry, c.userId)
      }
    }

    const entries = Array.from(entriesByMemoryId.values()).filter(
      (e) => e.reactionCount + e.commentCount > 0
    )
    if (entries.length === 0) continue

    let totalReactions = 0
    let totalComments = 0
    for (const e of entries) {
      totalReactions += e.reactionCount
      totalComments += e.commentCount
    }

    result.push({
      recipient,
      entries,
      totalReactions,
      totalComments,
    })
  }

  return result
}

export const __test = { DEFAULT_PREFS }
