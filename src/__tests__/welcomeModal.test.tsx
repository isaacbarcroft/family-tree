import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import WelcomeModal from "@/components/WelcomeModal"

const WELCOME_SEEN_KEY = "family_legacy_welcome_seen"

describe("WelcomeModal", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("renders the first onboarding step when localStorage has no seen flag", () => {
    render(<WelcomeModal />)
    expect(screen.getByText(/Welcome to Family Legacy/i)).toBeInTheDocument()
  })

  it("renders nothing when localStorage already has the seen flag", () => {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1")
    const { container } = render(<WelcomeModal />)
    expect(container).toBeEmptyDOMElement()
  })

  it("dismisses by writing the seen flag to localStorage and hides the modal", () => {
    render(<WelcomeModal />)
    expect(screen.getByText(/Welcome to Family Legacy/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Skip/i }))

    expect(window.localStorage.getItem(WELCOME_SEEN_KEY)).toBe("1")
    expect(screen.queryByText(/Welcome to Family Legacy/i)).not.toBeInTheDocument()
  })

  it("advances through steps and dismisses on the final 'Get Started' click", () => {
    render(<WelcomeModal />)
    const next = () => screen.getByRole("button", { name: /Next/i })

    fireEvent.click(next()) // step 2
    fireEvent.click(next()) // step 3
    fireEvent.click(next()) // step 4 — final, button reads "Get Started"

    fireEvent.click(screen.getByRole("button", { name: /Get Started/i }))

    expect(window.localStorage.getItem(WELCOME_SEEN_KEY)).toBe("1")
    expect(screen.queryByText(/Welcome to Family Legacy/i)).not.toBeInTheDocument()
  })
})
