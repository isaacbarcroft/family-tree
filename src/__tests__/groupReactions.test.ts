import { describe, expect, it } from "vitest"
import { groupReactionsByMemoryId } from "@/utils/groupReactions"
import type { MemoryReaction } from "@/models/MemoryReaction"

const r = (over: Partial<MemoryReaction>): MemoryReaction => ({
  id: over.id ?? "r-id",
  memoryId: over.memoryId ?? "m-1",
  userId: over.userId ?? "u-1",
  emoji: over.emoji ?? "❤️",
  createdAt: over.createdAt ?? "2026-04-29T00:00:00.000Z",
})

describe("groupReactionsByMemoryId", () => {
  it("returns an empty map when ids is empty (and ignores any rows)", () => {
    const result = groupReactionsByMemoryId([], [r({ id: "x", memoryId: "m-1" })])
    expect(result.size).toBe(0)
  })

  it("seeds every id with an empty array even when no reactions exist", () => {
    const result = groupReactionsByMemoryId(["a", "b", "c"], [])
    expect([...result.keys()]).toEqual(["a", "b", "c"])
    for (const id of ["a", "b", "c"]) {
      expect(result.get(id)).toEqual([])
    }
  })

  it("buckets reactions by memoryId, preserving relative order within each bucket", () => {
    const rows: MemoryReaction[] = [
      r({ id: "1", memoryId: "m-1", emoji: "❤️" }),
      r({ id: "2", memoryId: "m-2", emoji: "🙏" }),
      r({ id: "3", memoryId: "m-1", emoji: "😂" }),
      r({ id: "4", memoryId: "m-1", emoji: "😮" }),
    ]
    const result = groupReactionsByMemoryId(["m-1", "m-2", "m-3"], rows)

    expect(result.get("m-1")?.map((x) => x.id)).toEqual(["1", "3", "4"])
    expect(result.get("m-2")?.map((x) => x.id)).toEqual(["2"])
    expect(result.get("m-3")).toEqual([])
  })

  it("drops reactions whose memoryId is not in the requested id list", () => {
    const rows: MemoryReaction[] = [
      r({ id: "keep", memoryId: "m-1" }),
      r({ id: "drop", memoryId: "m-stale" }),
    ]
    const result = groupReactionsByMemoryId(["m-1"], rows)

    expect(result.get("m-1")?.map((x) => x.id)).toEqual(["keep"])
    expect(result.has("m-stale")).toBe(false)
    expect(result.size).toBe(1)
  })

  it("treats duplicate ids as a single bucket (last write wins on the seed, then rows append)", () => {
    const rows: MemoryReaction[] = [r({ id: "only", memoryId: "m-1" })]
    const result = groupReactionsByMemoryId(["m-1", "m-1"], rows)

    expect(result.size).toBe(1)
    expect(result.get("m-1")?.map((x) => x.id)).toEqual(["only"])
  })

  it("does not mutate the input ids or rows arrays", () => {
    const ids = ["m-1", "m-2"]
    const rows: MemoryReaction[] = [r({ id: "1", memoryId: "m-1" })]
    const idsBefore = [...ids]
    const rowsBefore = [...rows]

    groupReactionsByMemoryId(ids, rows)

    expect(ids).toEqual(idsBefore)
    expect(rows).toEqual(rowsBefore)
  })
})
