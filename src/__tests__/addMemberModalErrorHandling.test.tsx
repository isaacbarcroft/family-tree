import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

const linkParentChild = vi.fn<(parentId: string, childId: string) => Promise<void>>()
const linkSpouses = vi.fn<(a: string, b: string) => Promise<void>>()
const addPerson = vi.fn<(p: unknown) => Promise<{ id: string }>>()
const addRelationship = vi.fn<(r: unknown) => Promise<void>>()
const routerPush = vi.fn<(url: string) => void>()

vi.mock("@/lib/db", () => ({
  linkParentChild: (...args: [string, string]) => linkParentChild(...args),
  linkSpouses: (...args: [string, string]) => linkSpouses(...args),
  addPerson: (p: unknown) => addPerson(p),
  addRelationship: (r: unknown) => addRelationship(r),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}))

type SupabaseResult = { data: unknown; error: unknown }
let nextSearchResult: SupabaseResult = { data: [], error: null }

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        ilike: () => ({
          limit: () => Promise.resolve(nextSearchResult),
        }),
      }),
    }),
  },
}))

import AddMemberModal from "@/components/AddMemberModal"

function searchInput() {
  return screen.getByPlaceholderText(/Enter a name/i) as HTMLInputElement
}

async function typeAndWaitForSearch(value: string) {
  await act(async () => {
    fireEvent.change(searchInput(), { target: { value } })
  })
}

describe("AddMemberModal error handling", () => {
  beforeEach(() => {
    linkParentChild.mockReset()
    linkSpouses.mockReset()
    addPerson.mockReset()
    addRelationship.mockReset()
    routerPush.mockReset()
    addRelationship.mockResolvedValue(undefined)
    nextSearchResult = { data: [], error: null }
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("surfaces an error and keeps the modal open when linkParentChild throws", async () => {
    nextSearchResult = {
      data: [{ id: "person-2", firstName: "Ada", lastName: "Lovelace" }],
      error: null,
    }
    linkParentChild.mockRejectedValueOnce(new Error("RLS denied"))
    const onClose = vi.fn()
    const onLinked = vi.fn()

    render(
      <AddMemberModal
        onClose={onClose}
        onLinked={onLinked}
        currentPersonId="person-1"
      />,
    )

    await typeAndWaitForSearch("Ada")
    const result = await screen.findByRole(
      "button",
      { name: /Ada Lovelace/ },
      { timeout: 2000 },
    )

    await act(async () => {
      fireEvent.click(result)
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("RLS denied")
    expect(onClose).not.toHaveBeenCalled()
    expect(onLinked).not.toHaveBeenCalled()
    expect(addRelationship).not.toHaveBeenCalled()
  })

  it("re-enables the result button after a failed link so the user can retry", async () => {
    nextSearchResult = {
      data: [{ id: "person-2", firstName: "Ada", lastName: "Lovelace" }],
      error: null,
    }
    linkParentChild.mockRejectedValueOnce(new Error("RLS denied"))

    render(
      <AddMemberModal
        onClose={vi.fn()}
        onLinked={vi.fn()}
        currentPersonId="person-1"
      />,
    )

    await typeAndWaitForSearch("Ada")
    const result = await screen.findByRole(
      "button",
      { name: /Ada Lovelace/ },
      { timeout: 2000 },
    )

    await act(async () => {
      fireEvent.click(result)
    })

    await screen.findByRole("alert")
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Ada Lovelace/ }),
      ).not.toBeDisabled()
    })
  })

  it("keeps the modal open when addPerson throws in the create-and-link flow", async () => {
    nextSearchResult = { data: [], error: null }
    addPerson.mockRejectedValueOnce(new Error("duplicate key"))
    const onClose = vi.fn()
    const onLinked = vi.fn()

    render(
      <AddMemberModal
        onClose={onClose}
        onLinked={onLinked}
        currentPersonId="person-1"
      />,
    )

    await typeAndWaitForSearch("Grace Hopper")

    const createButton = await screen.findByRole(
      "button",
      { name: /Create .* and Link/ },
      { timeout: 2000 },
    )
    await act(async () => {
      fireEvent.click(createButton)
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("duplicate key")
    expect(onClose).not.toHaveBeenCalled()
    expect(onLinked).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
    expect(linkParentChild).not.toHaveBeenCalled()
  })

  it("reports a partial-success message when the created person cannot be linked", async () => {
    nextSearchResult = { data: [], error: null }
    addPerson.mockResolvedValueOnce({ id: "new-person" })
    linkParentChild.mockRejectedValueOnce(new Error("policy violation"))
    const onClose = vi.fn()
    const onLinked = vi.fn()

    render(
      <AddMemberModal
        onClose={onClose}
        onLinked={onLinked}
        currentPersonId="person-1"
      />,
    )

    await typeAndWaitForSearch("Grace Hopper")

    const createButton = await screen.findByRole(
      "button",
      { name: /Create .* and Link/ },
      { timeout: 2000 },
    )
    await act(async () => {
      fireEvent.click(createButton)
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("policy violation")
    expect(onClose).not.toHaveBeenCalled()
    expect(onLinked).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it("closes the modal and navigates when the create-and-link flow succeeds", async () => {
    nextSearchResult = { data: [], error: null }
    addPerson.mockResolvedValueOnce({ id: "new-person" })
    linkParentChild.mockResolvedValueOnce(undefined)
    const onClose = vi.fn()
    const onLinked = vi.fn()

    render(
      <AddMemberModal
        onClose={onClose}
        onLinked={onLinked}
        currentPersonId="person-1"
      />,
    )

    await typeAndWaitForSearch("Grace Hopper")

    const createButton = await screen.findByRole(
      "button",
      { name: /Create .* and Link/ },
      { timeout: 2000 },
    )
    await act(async () => {
      fireEvent.click(createButton)
    })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
    expect(onLinked).toHaveBeenCalledTimes(1)
    expect(routerPush).toHaveBeenCalledWith("/profile/new-person?edit=true")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("clears a prior error when the user edits the search input", async () => {
    nextSearchResult = {
      data: [{ id: "person-2", firstName: "Ada", lastName: "Lovelace" }],
      error: null,
    }
    linkParentChild.mockRejectedValueOnce(new Error("RLS denied"))

    render(
      <AddMemberModal
        onClose={vi.fn()}
        onLinked={vi.fn()}
        currentPersonId="person-1"
      />,
    )

    await typeAndWaitForSearch("Ada")
    const result = await screen.findByRole(
      "button",
      { name: /Ada Lovelace/ },
      { timeout: 2000 },
    )
    await act(async () => {
      fireEvent.click(result)
    })
    await screen.findByRole("alert")

    await act(async () => {
      fireEvent.change(searchInput(), { target: { value: "Adb" } })
    })

    expect(screen.queryByRole("alert")).toBeNull()
  })
})
