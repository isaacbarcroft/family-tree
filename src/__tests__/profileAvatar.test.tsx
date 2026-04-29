import { describe, expect, it } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { ProfileAvatar } from "@/components/ProfileAvatar"

const SUPABASE_PREFIX =
  "https://abc.supabase.co/storage/v1/object/public/media/people/p1/photos"

describe("ProfileAvatar", () => {
  it("renders the source image when given a Supabase URL", () => {
    render(
      <ProfileAvatar
        src={`${SUPABASE_PREFIX}/avatar.jpg`}
        alt="Ada Lovelace"
        fallbackLetters="AL"
      />,
    )
    const img = screen.getByAltText("Ada Lovelace") as HTMLImageElement
    expect(img.tagName).toBe("IMG")
    expect(img.getAttribute("src")).toBe(`${SUPABASE_PREFIX}/avatar.jpg`)
  })

  it("renders the initials fallback when no src is given", () => {
    render(
      <ProfileAvatar src={null} alt="Ada Lovelace" fallbackLetters="Ada Lovelace" />,
    )
    expect(screen.queryByAltText("Ada Lovelace")).not.toBeInTheDocument()
    expect(screen.getByText("AL")).toBeInTheDocument()
  })

  it("falls back to initials after the image load fails", () => {
    render(
      <ProfileAvatar
        src={`${SUPABASE_PREFIX}/broken.jpg`}
        alt="Ada Lovelace"
        fallbackLetters="Ada Lovelace"
      />,
    )
    const img = screen.getByAltText("Ada Lovelace")
    act(() => {
      fireEvent.error(img)
    })
    expect(screen.queryByAltText("Ada Lovelace")).not.toBeInTheDocument()
    expect(screen.getByText("AL")).toBeInTheDocument()
  })

  it("retries loading the image when the src prop changes (post-error reset)", () => {
    // Regression test for the React 19 set-state-in-effect refactor: when the
    // caller swaps `src` (e.g. after the user uploads a new photo), the error
    // state must reset so the new image gets a chance to render. Previously
    // this was wired through useEffect; it now syncs during render via a
    // prevSrc tracker, which must keep the same behavior.
    const { rerender } = render(
      <ProfileAvatar
        src={`${SUPABASE_PREFIX}/old.jpg`}
        alt="Ada Lovelace"
        fallbackLetters="AL"
      />,
    )

    act(() => {
      fireEvent.error(screen.getByAltText("Ada Lovelace"))
    })
    expect(screen.queryByAltText("Ada Lovelace")).not.toBeInTheDocument()

    rerender(
      <ProfileAvatar
        src={`${SUPABASE_PREFIX}/new.jpg`}
        alt="Ada Lovelace"
        fallbackLetters="AL"
      />,
    )

    const retried = screen.getByAltText("Ada Lovelace") as HTMLImageElement
    expect(retried.getAttribute("src")).toBe(`${SUPABASE_PREFIX}/new.jpg`)
  })
})
