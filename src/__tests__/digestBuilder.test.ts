import { describe, expect, it } from "vitest"
import {
  buildDigests,
  isDigestDue,
  normalizePrefs,
  type DigestRecipient,
} from "@/utils/digest"

const NOW = new Date("2026-05-05T12:00:00Z")

function makeRecipient(overrides: Partial<DigestRecipient> = {}): DigestRecipient {
  return {
    userId: "u1",
    email: "u1@example.com",
    prefs: { digest: "weekly", reactions: true, comments: true },
    unsubscribeToken: "00000000-0000-0000-0000-000000000001",
    lastDigestSentAt: null,
    createdAt: "2026-04-01T00:00:00Z",
    ...overrides,
  }
}

describe("normalizePrefs", () => {
  it("returns defaults when given null", () => {
    expect(normalizePrefs(null)).toEqual({
      digest: "weekly",
      reactions: true,
      comments: true,
    })
  })

  it("returns defaults when given a non-object", () => {
    expect(normalizePrefs("nope")).toEqual({
      digest: "weekly",
      reactions: true,
      comments: true,
    })
    expect(normalizePrefs(42)).toEqual({
      digest: "weekly",
      reactions: true,
      comments: true,
    })
  })

  it("preserves valid digest values and booleans", () => {
    expect(
      normalizePrefs({
        digest: "daily",
        reactions: false,
        comments: false,
      })
    ).toEqual({ digest: "daily", reactions: false, comments: false })
  })

  it("clamps unknown digest values back to weekly", () => {
    expect(
      normalizePrefs({ digest: "monthly", reactions: true, comments: true })
    ).toEqual({ digest: "weekly", reactions: true, comments: true })
  })

  it("falls back to defaults when individual fields are missing", () => {
    expect(normalizePrefs({ digest: "off" })).toEqual({
      digest: "off",
      reactions: true,
      comments: true,
    })
  })
})

describe("isDigestDue", () => {
  it("returns false when digest is off, regardless of timing", () => {
    const recipient = makeRecipient({
      prefs: { digest: "off", reactions: true, comments: true },
      lastDigestSentAt: "2020-01-01T00:00:00Z",
    })
    expect(isDigestDue(recipient, NOW)).toBe(false)
  })

  it("returns true on first run for a daily user older than a day", () => {
    const recipient = makeRecipient({
      prefs: { digest: "daily", reactions: true, comments: true },
      createdAt: "2026-05-04T00:00:00Z",
      lastDigestSentAt: null,
    })
    expect(isDigestDue(recipient, NOW)).toBe(true)
  })

  it("returns false on first run for a daily user younger than a day", () => {
    const recipient = makeRecipient({
      prefs: { digest: "daily", reactions: true, comments: true },
      createdAt: "2026-05-05T01:00:00Z",
      lastDigestSentAt: null,
    })
    expect(isDigestDue(recipient, NOW)).toBe(false)
  })

  it("respects 7-day spacing for weekly users", () => {
    const recipient = makeRecipient({
      prefs: { digest: "weekly", reactions: true, comments: true },
      lastDigestSentAt: "2026-05-01T00:00:00Z",
    })
    expect(isDigestDue(recipient, NOW)).toBe(false)
  })

  it("returns true once 7 days elapse for weekly users", () => {
    const recipient = makeRecipient({
      prefs: { digest: "weekly", reactions: true, comments: true },
      lastDigestSentAt: "2026-04-28T11:00:00Z",
    })
    expect(isDigestDue(recipient, NOW)).toBe(true)
  })
})

describe("buildDigests", () => {
  const memories = [
    { id: "m1", title: "Wedding day", date: "2021-05-04", createdBy: "owner1" },
    { id: "m2", title: "Beach trip", date: "2019-05-03", createdBy: "owner2" },
  ]
  const events = [
    { id: "e1", title: "Graduation", date: "2016-05-02" },
    { id: "e2", title: "Housewarming", date: "2024-05-04" },
  ]
  const people = [
    {
      id: "p1",
      userId: "actor1",
      firstName: "Alex",
      lastName: "Doe",
      birthDate: "1990-05-04",
      deathDate: null,
    },
    {
      id: "p2",
      userId: "actor2",
      firstName: "Bea",
      lastName: "Lee",
      birthDate: "1988-05-02",
      deathDate: null,
    },
    {
      id: "p3",
      userId: null,
      firstName: "Grandpa",
      lastName: "Jones",
      birthDate: "1940-05-01",
      deathDate: "2020-08-01",
    },
  ]
  const actorNames = [
    { userId: "actor1", displayName: "Alex Doe" },
    { userId: "actor2", displayName: "Bea Lee" },
  ]

  it("groups reactions by memory owner and lists unique actor names", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        email: "owner1@example.com",
        lastDigestSentAt: "2026-04-20T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "m1",
        userId: "actor1",
        emoji: "❤️",
        createdAt: "2026-05-01T00:00:00Z",
      },
      {
        memoryId: "m1",
        userId: "actor1",
        emoji: "😂",
        createdAt: "2026-05-02T00:00:00Z",
      },
      {
        memoryId: "m1",
        userId: "actor2",
        emoji: "❤️",
        createdAt: "2026-05-03T00:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(1)
    expect(out[0].totalReactions).toBe(3)
    expect(out[0].totalComments).toBe(0)
    expect(out[0].entries).toHaveLength(1)
    expect(out[0].entries[0].memoryId).toBe("m1")
    expect(out[0].entries[0].actorNames).toEqual(["Alex Doe", "Bea Lee"])
  })

  it("excludes activity by the recipient themselves", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        lastDigestSentAt: "2026-04-20T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "m1",
        userId: "owner1",
        emoji: "❤️",
        createdAt: "2026-05-01T00:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(1)
    expect(out[0].entries).toEqual([])
  })

  it("excludes activity that pre-dates lastDigestSentAt", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        prefs: { digest: "daily", reactions: true, comments: true },
        lastDigestSentAt: "2026-05-04T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "m1",
        userId: "actor1",
        emoji: "❤️",
        createdAt: "2026-05-01T00:00:00Z",
      },
      {
        memoryId: "m1",
        userId: "actor2",
        emoji: "🙏",
        createdAt: "2026-05-04T12:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(1)
    expect(out[0].totalReactions).toBe(1)
    expect(out[0].entries[0].actorNames).toEqual(["Bea Lee"])
  })

  it("does not notify a recipient about another user's memory", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        lastDigestSentAt: "2026-04-01T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "m2",
        userId: "actor1",
        emoji: "❤️",
        createdAt: "2026-05-01T00:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(1)
    expect(out[0].entries).toEqual([])
  })

  it("respects muteReactions and muteComments prefs", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        prefs: { digest: "daily", reactions: false, comments: true },
        lastDigestSentAt: "2026-04-01T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "m1",
        userId: "actor1",
        emoji: "❤️",
        createdAt: "2026-05-04T00:00:00Z",
      },
    ]
    const comments = [
      {
        memoryId: "m1",
        userId: "actor1",
        body: "love this",
        createdAt: "2026-05-04T01:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments,
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(1)
    expect(out[0].totalReactions).toBe(0)
    expect(out[0].totalComments).toBe(1)
  })

  it("skips recipients whose digest is off entirely", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        prefs: { digest: "off", reactions: true, comments: true },
        lastDigestSentAt: null,
      }),
    ]
    const reactions = [
      {
        memoryId: "m1",
        userId: "actor1",
        emoji: "❤️",
        createdAt: "2026-05-04T00:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toEqual([])
  })

  it("falls back to a generic actor name when the user has no person row", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        lastDigestSentAt: "2026-04-01T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "m1",
        userId: "ghost",
        emoji: "❤️",
        createdAt: "2026-05-04T00:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(1)
    expect(out[0].entries[0].actorNames).toEqual(["A family member"])
  })

  it("ignores activity on a memory that does not exist in the memories list", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        lastDigestSentAt: "2026-04-01T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "missing",
        userId: "actor1",
        emoji: "❤️",
        createdAt: "2026-05-04T00:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(1)
    expect(out[0].entries).toEqual([])
  })

  it("processes multiple recipients in one call", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        email: "owner1@example.com",
        lastDigestSentAt: "2026-04-01T00:00:00Z",
      }),
      makeRecipient({
        userId: "owner2",
        email: "owner2@example.com",
        lastDigestSentAt: "2026-04-01T00:00:00Z",
      }),
    ]
    const reactions = [
      {
        memoryId: "m1",
        userId: "actor1",
        emoji: "❤️",
        createdAt: "2026-05-04T00:00:00Z",
      },
      {
        memoryId: "m2",
        userId: "actor2",
        emoji: "🙏",
        createdAt: "2026-05-04T00:00:00Z",
      },
    ]
    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions,
      comments: [],
      actorNames,
      now: NOW,
    })
    expect(out).toHaveLength(2)
    expect(out.map((d) => d.recipient.userId).sort()).toEqual([
      "owner1",
      "owner2",
    ])
  })

  it("adds birthdays and anniversaries that fall within the digest window", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        prefs: { digest: "daily", reactions: true, comments: true },
        lastDigestSentAt: "2026-05-01T00:00:00Z",
      }),
    ]

    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions: [],
      comments: [],
      actorNames,
      now: NOW,
    })

    expect(out).toHaveLength(1)
    expect(out[0].entries).toEqual([])
    expect(out[0].totalBirthdays).toBe(2)
    expect(out[0].totalAnniversaries).toBe(2)
    expect(out[0].birthdays.map((entry) => entry.displayName)).toEqual([
      "Bea Lee",
      "Alex Doe",
    ])
    expect(out[0].birthdays.map((entry) => entry.age)).toEqual([38, 36])
    expect(out[0].anniversaries.map((entry) => `${entry.kind}:${entry.title}`)).toEqual([
      "event:Graduation",
      "memory:Wedding day",
    ])
  })

  it("skips deceased people and non-milestone anniversaries", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        prefs: { digest: "daily", reactions: true, comments: true },
        lastDigestSentAt: "2026-04-30T00:00:00Z",
      }),
    ]

    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions: [],
      comments: [],
      actorNames,
      now: NOW,
    })

    expect(out).toHaveLength(1)
    expect(out[0].birthdays.some((entry) => entry.displayName === "Grandpa Jones")).toBe(false)
    expect(out[0].anniversaries.some((entry) => entry.title === "Housewarming")).toBe(false)
    expect(out[0].anniversaries.some((entry) => entry.title === "Beach trip")).toBe(false)
  })

  it("returns no digest when the window has no activity, birthdays, or anniversaries", () => {
    const recipients = [
      makeRecipient({
        userId: "owner1",
        prefs: { digest: "daily", reactions: true, comments: true },
        lastDigestSentAt: "2026-05-05T11:30:00Z",
      }),
    ]

    const out = buildDigests({
      recipients,
      memories,
      events,
      people,
      reactions: [],
      comments: [],
      actorNames,
      now: NOW,
    })

    expect(out).toEqual([])
  })
})
