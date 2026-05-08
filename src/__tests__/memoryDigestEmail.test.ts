import { describe, expect, it } from "vitest"
import {
  buildDigestHtml,
  buildDigestSubject,
} from "@/lib/emails/memory-digest"

describe("buildDigestSubject", () => {
  it("pluralizes across activity and reminder sections", () => {
    expect(
      buildDigestSubject({
        totalReactions: 3,
        totalComments: 1,
        totalBirthdays: 2,
        totalAnniversaries: 1,
      })
    ).toBe(
      "3 new reactions and 1 new comment and 2 birthdays and 1 family anniversary in your family tree"
    )
  })

  it("omits zero-count sections", () => {
    expect(
      buildDigestSubject({
        totalReactions: 0,
        totalComments: 0,
        totalBirthdays: 1,
        totalAnniversaries: 0,
      })
    ).toBe("1 birthday in your family tree")
  })

  it("falls back to a generic subject when every section is empty", () => {
    expect(
      buildDigestSubject({
        totalReactions: 0,
        totalComments: 0,
        totalBirthdays: 0,
        totalAnniversaries: 0,
      })
    ).toBe("Updates from your family tree")
  })
})

describe("buildDigestHtml", () => {
  it("renders memory activity, birthdays, and anniversaries without breaking on quotes", () => {
    const html = buildDigestHtml({
      firstName: "Owen",
      totalReactions: 2,
      totalComments: 1,
      totalBirthdays: 1,
      totalAnniversaries: 1,
      entries: [
        {
          memoryId: "m1",
          memoryTitle: 'Grandpa\'s "fishing trip"',
          reactionCount: 2,
          commentCount: 1,
          actorNames: ["Alex Doe", "Bea <Lee>"],
        },
      ],
      birthdays: [
        {
          personId: "p1",
          displayName: "Maya <Stone>",
          age: 40,
          occurrenceDate: "2026-05-05T00:00:00.000Z",
        },
      ],
      anniversaries: [
        {
          itemId: "e1",
          title: 'Parents\' "wedding"',
          kind: "event",
          yearsAgo: 25,
          occurrenceDate: "2026-05-05T00:00:00.000Z",
          originalDate: "2001-05-05",
        },
      ],
      unsubscribeUrl: "https://family.example/u?token=abc",
      appUrl: "https://family.example",
    })
    expect(html).toContain("Hi Owen")
    expect(html).toContain("2 new reactions and 1 new comment and 1 birthday and 1 family anniversary")
    expect(html).toContain("Grandpa&#39;s &quot;fishing trip&quot;")
    expect(html).toContain("Bea &lt;Lee&gt;")
    expect(html).toContain("Maya &lt;Stone&gt; turns 40")
    expect(html).toContain("Parents&#39; &quot;wedding&quot;")
    expect(html).toContain("Event from 25 years ago")
    expect(html).toContain("https://family.example/u?token=abc")
  })

  it("falls back to 'there' when first name is empty", () => {
    const html = buildDigestHtml({
      firstName: "   ",
      totalReactions: 0,
      totalComments: 0,
      totalBirthdays: 1,
      totalAnniversaries: 0,
      entries: [],
      birthdays: [],
      anniversaries: [],
      unsubscribeUrl: "https://family.example/u?token=abc",
      appUrl: "https://family.example",
    })
    expect(html).toContain("Hi there")
  })
})
