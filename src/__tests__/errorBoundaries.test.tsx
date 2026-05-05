import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import RouteError from "@/app/error"
import GlobalError from "@/app/global-error"

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("app/error.tsx (RouteError)", () => {
  it("renders an alert region with friendly copy and a Go Home link", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc-123" })
    render(<RouteError error={error} reset={() => {}} />)

    const alert = screen.getByRole("alert")
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/something went wrong on this page/i)).toBeInTheDocument()
    const home = screen.getByRole("link", { name: /go home/i })
    expect(home).toHaveAttribute("href", "/")
  })

  it("invokes reset() when Try Again is clicked", () => {
    const reset = vi.fn()
    const error = Object.assign(new Error("boom"), { digest: "abc-123" })
    render(<RouteError error={error} reset={reset} />)

    fireEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("shows the error message in development", () => {
    vi.stubEnv("NODE_ENV", "development")
    const error = Object.assign(new Error("dev-only-detail"), { digest: "xyz" })
    render(<RouteError error={error} reset={() => {}} />)

    expect(screen.getByText("dev-only-detail")).toBeInTheDocument()
    expect(screen.queryByText(/reference:/i)).not.toBeInTheDocument()
  })

  it("hides the error message but shows the digest in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    const error = Object.assign(new Error("hidden-from-users"), { digest: "support-ref-7" })
    render(<RouteError error={error} reset={() => {}} />)

    expect(screen.queryByText("hidden-from-users")).not.toBeInTheDocument()
    expect(screen.getByText(/reference:/i)).toBeInTheDocument()
    expect(screen.getByText("support-ref-7")).toBeInTheDocument()
  })

  it("logs the caught error so it surfaces in dev tools", () => {
    const error = Object.assign(new Error("traceable"), { digest: "d1" })
    render(<RouteError error={error} reset={() => {}} />)

    expect(console.error).toHaveBeenCalledWith(
      "Route error boundary caught:",
      error,
    )
  })
})

describe("app/global-error.tsx (GlobalError)", () => {
  it("renders an alert region with the catastrophic-failure copy", () => {
    const error = Object.assign(new Error("layout-broke"), { digest: "g-1" })
    render(<GlobalError error={error} reset={() => {}} />)

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText(/the app couldn't load/i)).toBeInTheDocument()
  })

  it("invokes reset() when Try Again is clicked", () => {
    const reset = vi.fn()
    const error = Object.assign(new Error("layout-broke"), { digest: "g-1" })
    render(<GlobalError error={error} reset={reset} />)

    fireEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("logs the caught error", () => {
    const error = Object.assign(new Error("layout-broke"), { digest: "g-1" })
    render(<GlobalError error={error} reset={() => {}} />)

    expect(console.error).toHaveBeenCalledWith(
      "Global error boundary caught:",
      error,
    )
  })
})
