import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, act } from "@testing-library/react"

vi.mock("@/lib/db", () => ({
  addMemory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/storage", () => ({
  uploadMemoryPhoto: vi.fn().mockResolvedValue("https://example.com/m.jpg"),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
        ilike: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}))

vi.mock("@/utils/heic", () => ({
  convertHeicToJpeg: vi.fn(),
  isHeicFile: () => false,
  isHeicFileByMagic: vi.fn().mockResolvedValue(false),
}))

import AddMemoryModal from "@/components/AddMemoryModal"

function makeImage(name: string): File {
  return new File(["x"], name, { type: "image/jpeg" })
}

describe("AddMemoryModal blob URL lifecycle", () => {
  const created: string[] = []
  const revoked: string[] = []
  let counter = 0

  beforeEach(() => {
    created.length = 0
    revoked.length = 0
    counter = 0
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:mock/${++counter}`
      created.push(url)
      return url
    })
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
      revoked.push(url)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("revokes a preview URL when the user removes that file", async () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = makeImage("photo.jpg")

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    expect(created).toHaveLength(1)
    expect(revoked).toHaveLength(0)

    // Remove the preview via the "x" button inside the preview grid.
    const removeButton = screen.getAllByRole("button", { name: "x" })[0]
    await act(async () => {
      fireEvent.click(removeButton)
    })

    expect(revoked).toEqual([created[0]])
  })

  it("revokes all outstanding preview URLs when the modal unmounts", async () => {
    const { unmount } = render(
      <AddMemoryModal onClose={() => {}} onCreated={() => {}} />
    )

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [makeImage("a.jpg"), makeImage("b.jpg")] },
      })
    })

    expect(created).toHaveLength(2)
    expect(revoked).toHaveLength(0)

    unmount()

    expect(revoked).toEqual(expect.arrayContaining(created))
    expect(revoked).toHaveLength(created.length)
  })
})
