import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const useAuthMock = vi.fn()
const pushMock = vi.fn()

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

import ProtectedRoute from "@/components/ProtectedRoute"

beforeEach(() => {
  useAuthMock.mockReset()
  pushMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ProtectedRoute", () => {
  it("renders children when a user is signed in", () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
    render(
      <ProtectedRoute>
        <p>secret content</p>
      </ProtectedRoute>,
    )
    expect(screen.getByText("secret content")).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("shows a loading message while auth is resolving", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true })
    render(
      <ProtectedRoute>
        <p>secret content</p>
      </ProtectedRoute>,
    )
    expect(screen.getByText(/Loading/)).toBeInTheDocument()
    expect(screen.queryByText("secret content")).not.toBeInTheDocument()
  })

  it("redirects to /login when auth has resolved and there is no user", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    render(
      <ProtectedRoute>
        <p>secret content</p>
      </ProtectedRoute>,
    )
    expect(pushMock).toHaveBeenCalledWith("/login")
    expect(screen.queryByText("secret content")).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Design-system migration regression pin (paper theme, not dark gray).
  // ---------------------------------------------------------------------------

  it("renders the loading copy in ink-3 (not legacy text-gray-400)", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true })
    render(
      <ProtectedRoute>
        <p>secret content</p>
      </ProtectedRoute>,
    )
    const message = screen.getByText(/Loading/)
    const inline = message.getAttribute("style") ?? ""
    expect(inline).toContain("var(--ink-3)")
    expect(message.className).not.toMatch(/text-gray-/)
  })
})
