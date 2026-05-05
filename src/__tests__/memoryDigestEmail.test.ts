import { describe, expect, it } from "vitest"
import {
  buildDigestHtml,
  buildDigestSubject,
} from "@/lib/emails/memory-digest"

describe("buildDigestSubject", () => {
  it("pluralizes correctly when both reactions and comments arrive", () => {
    expect(
      buildDigestSubject({ totalReactions: 3, totalComments: 1 })
    ).toBe("3 new reactions and 1 new comment on your memories")
  })

  it("omits the zero-count side", () => {
    expect(
      buildDigestSubject({ totalReactions: 1, totalComments: 0 })
    ).toBe("1 new reaction on your memories")
    expect(
      buildDigestSubject({ totalReactions: 0, totalComments: 4 })
    ).toBe("4 new comments on your memories")
  })

  it("falls back to a generic subject when both counts are zero", () => {
    expect(
      buildDigestSubject({ totalReactions: 0, totalComments: 0 })
    ).toBe("Activity on your memories")
  })
})

describe("buildDigestHtml", () => {
  it("renders memory titles and actor names without breaking on quotes", () => {
    const html = buildDigestHtml({
      firstName: "Owen",
      totalReactions: 2,
      totalComments: 1,
      entries: [
        {
          memoryId: "m1",
          memoryTitle: 'Grandpa\'s "fishing trip"',
          reactionCount: 2,
          commentCount: 1,
          actorNames: ["Alex Doe", "Bea <Lee>"],
        },
      ],
      unsubscribeUrl: "https://family.example/u?token=abc",
      appUrl: "https://family.example",
    })
    expect(html).toContain("Hi Owen")
    expect(html).toContain("2 new reactions and 1 new comment")
    expect(html).toContain("Grandpa&#39;s &quot;fishing trip&quot;")
    expect(html).toContain("Bea &lt;Lee&gt;")
    expect(html).toContain("https://family.example/u?token=abc")
  })

  it("falls back to 'there' when first name is empty", () => {
    const html = buildDigestHtml({
      firstName: "   ",
      totalReactions: 1,
      totalComments: 0,
      entries: [],
      unsubscribeUrl: "https://family.example/u?token=abc",
      appUrl: "https://family.example",
    })
    expect(html).toContain("Hi there")
  })
})
