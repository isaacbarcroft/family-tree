import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { Person } from "@/models/Person"

const personFixture: Person = {
  id: "person-1",
  firstName: "Ada",
  lastName: "Lovelace",
  roleType: "family member",
  createdBy: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
}

const getPersonById = vi.fn<(id: string) => Promise<Person | null>>()
const listEventsForPerson = vi.fn<(id: string) => Promise<unknown[]>>()
const listMemoriesForPerson = vi.fn<(id: string) => Promise<unknown[]>>()
const listFamiliesForPerson = vi.fn<(id: string) => Promise<unknown[]>>()
const listRelationshipsForPerson = vi.fn<(id: string) => Promise<unknown[]>>()
const listPeople = vi.fn<() => Promise<Person[]>>()
const listPeopleByIds = vi.fn<(ids: string[]) => Promise<Person[]>>()

vi.mock("@/lib/db", () => ({
  getPersonById: (id: string) => getPersonById(id),
  listEventsForPerson: (id: string) => listEventsForPerson(id),
  listMemoriesForPerson: (id: string) => listMemoriesForPerson(id),
  listFamiliesForPerson: (id: string) => listFamiliesForPerson(id),
  listRelationshipsForPerson: (id: string) => listRelationshipsForPerson(id),
  listPeople: () => listPeople(),
  listPeopleByIds: (ids: string[]) => listPeopleByIds(ids),
  listResidencesForPerson: vi.fn(() => Promise.resolve([])),
  addResidence: vi.fn(),
  deleteResidence: vi.fn(),
  updateResidence: vi.fn(),
  savePerson: vi.fn(),
  updatePerson: vi.fn(),
  unlinkParentChild: vi.fn(),
  unlinkSpouses: vi.fn(),
}))

vi.mock("@/lib/storage", () => ({
  uploadProfilePhoto: vi.fn(),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "person-1" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/profile/person-1",
}))

// AddMemoryModal pulls in MediaRecorder; jsdom does not provide it. Stub all
// three add-modals out of the test render — they only mount when the user
// opens them, but the imports still execute at module load.
vi.mock("@/components/AddFamilyModal", () => ({ default: () => null }))
vi.mock("@/components/AddMemberModal", () => ({ default: () => null }))
vi.mock("@/components/AddMemoryModal", () => ({ default: () => null }))

import ProfilePage from "@/app/profile/[id]/page"

describe("/profile/[id] heading focus", () => {
  beforeEach(() => {
    getPersonById.mockReset()
    listEventsForPerson.mockReset()
    listMemoriesForPerson.mockReset()
    listFamiliesForPerson.mockReset()
    listRelationshipsForPerson.mockReset()
    listPeople.mockReset()
    listPeopleByIds.mockReset()

    listEventsForPerson.mockResolvedValue([])
    listMemoriesForPerson.mockResolvedValue([])
    listFamiliesForPerson.mockResolvedValue([])
    listRelationshipsForPerson.mockResolvedValue([])
    listPeople.mockResolvedValue([])
    listPeopleByIds.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the main heading with tabIndex=-1 so it is programmatically focusable", async () => {
    getPersonById.mockResolvedValue(personFixture)

    render(<ProfilePage />)

    const heading = await screen.findByRole("heading", { name: /^Ada/, level: 1 })
    expect(heading.getAttribute("tabindex")).toBe("-1")
  })

  it("moves keyboard focus to the main heading once the person record loads", async () => {
    getPersonById.mockResolvedValue(personFixture)

    render(<ProfilePage />)

    const heading = await screen.findByRole("heading", { name: /^Ada/, level: 1 })
    await waitFor(() => {
      expect(document.activeElement).toBe(heading)
    })
  })

  it("does not throw or steal focus while the person record is still loading", async () => {
    // Resolve well after the initial render so we can assert the pre-load
    // state. The body is the focused element until the page has data.
    let resolvePerson: ((p: Person) => void) | null = null
    getPersonById.mockImplementation(
      () =>
        new Promise<Person>((res) => {
          resolvePerson = res
        }),
    )

    render(<ProfilePage />)

    // Mid-load: the loading state is on screen and focus has not yet moved.
    await screen.findByText(/Loading profile/i)
    expect(document.activeElement).toBe(document.body)

    resolvePerson?.(personFixture)

    const heading = await screen.findByRole("heading", { name: /^Ada/, level: 1 })
    await waitFor(() => {
      expect(document.activeElement).toBe(heading)
    })
  })

  it("does not move focus when the page mounts directly into edit mode", async () => {
    // Re-route useSearchParams so the page reads ?edit=true on mount. The
    // Hero is unmounted in edit mode, so its heading ref is null and the
    // focus effect must short-circuit cleanly.
    vi.doMock("next/navigation", () => ({
      useParams: () => ({ id: "person-1" }),
      useRouter: () => ({ push: vi.fn() }),
      useSearchParams: () => new URLSearchParams("edit=true"),
      usePathname: () => "/profile/person-1",
    }))
    vi.resetModules()
    getPersonById.mockResolvedValue(personFixture)

    const { default: ProfilePageEditMode } = await import(
      "@/app/profile/[id]/page"
    )

    render(<ProfilePageEditMode />)

    // Edit mode shows "Editing profile" eyebrow rather than the Hero h1.
    await screen.findByText(/Editing profile/i)
    expect(document.activeElement).toBe(document.body)
    expect(screen.queryByRole("heading", { name: /^Ada/, level: 1 })).toBeNull()
  })
})
