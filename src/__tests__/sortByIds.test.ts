import { describe, it, expect } from "vitest"
import { sortByIds } from "@/lib/db"

interface Item {
  id: string
  name: string
}

describe("sortByIds", () => {
  it("preserves the order of ids", () => {
    const items: Item[] = [
      { id: "b", name: "Bob" },
      { id: "a", name: "Alice" },
      { id: "c", name: "Carol" },
    ]
    const sorted = sortByIds(items, ["a", "b", "c"], (i) => i.id)
    expect(sorted.map((i) => i.id)).toEqual(["a", "b", "c"])
  })

  it("drops items whose id isn't in the id list", () => {
    const items: Item[] = [
      { id: "a", name: "Alice" },
      { id: "x", name: "Extra" },
      { id: "b", name: "Bob" },
    ]
    const sorted = sortByIds(items, ["a", "b"], (i) => i.id)
    expect(sorted.map((i) => i.id)).toEqual(["a", "b"])
  })

  it("skips ids that have no matching item", () => {
    const items: Item[] = [{ id: "a", name: "Alice" }]
    const sorted = sortByIds(items, ["a", "missing", "also-missing"], (i) => i.id)
    expect(sorted.map((i) => i.id)).toEqual(["a"])
  })

  it("returns an empty array when ids is empty", () => {
    const items: Item[] = [{ id: "a", name: "Alice" }]
    expect(sortByIds(items, [], (i) => i.id)).toEqual([])
  })

  it("returns an empty array when items is empty", () => {
    expect(sortByIds<Item>([], ["a"], (i) => i.id)).toEqual([])
  })

  it("handles duplicate ids by repeating the same item reference", () => {
    const alice = { id: "a", name: "Alice" }
    const sorted = sortByIds([alice], ["a", "a", "a"], (i) => i.id)
    expect(sorted).toHaveLength(3)
    for (const entry of sorted) {
      expect(entry).toBe(alice)
    }
  })

  it("works with arbitrary object shapes via the id accessor", () => {
    const rows = [
      { key: "2", label: "Second" },
      { key: "1", label: "First" },
    ]
    const sorted = sortByIds(rows, ["1", "2"], (r) => r.key)
    expect(sorted.map((r) => r.label)).toEqual(["First", "Second"])
  })
})
