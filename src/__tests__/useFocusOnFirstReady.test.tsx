import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { useFocusOnFirstReady } from "@/utils/useFocusOnFirstReady"

function Heading({
  ready,
  keyId,
  text = "Heading",
}: {
  ready: boolean
  keyId: unknown
  text?: string
}) {
  const ref = useFocusOnFirstReady<HTMLHeadingElement>(ready, keyId)
  return (
    <h1 ref={ref} tabIndex={-1}>
      {text}
    </h1>
  )
}

describe("useFocusOnFirstReady", () => {
  it("does not focus the target while `ready` is false", () => {
    render(<Heading ready={false} keyId="a" />)
    expect(document.activeElement).toBe(document.body)
  })

  it("focuses the target the first time `ready` flips to true", () => {
    const { rerender, container } = render(<Heading ready={false} keyId="a" />)
    expect(document.activeElement).toBe(document.body)

    rerender(<Heading ready={true} keyId="a" />)

    const heading = container.querySelector("h1")
    expect(heading).not.toBeNull()
    expect(document.activeElement).toBe(heading)
  })

  it("does not steal focus back on subsequent re-renders with the same key", () => {
    const { rerender, container } = render(<Heading ready={true} keyId="a" />)
    const heading = container.querySelector("h1")
    expect(document.activeElement).toBe(heading)

    // Simulate the user moving focus elsewhere (e.g. clicking a button on the
    // page). A re-render with the same `ready` + `key` must not pull focus
    // back to the heading.
    const button = document.createElement("button")
    document.body.appendChild(button)
    button.focus()
    expect(document.activeElement).toBe(button)

    rerender(<Heading ready={true} keyId="a" text="Heading (updated)" />)
    expect(document.activeElement).toBe(button)

    document.body.removeChild(button)
  })

  it("re-focuses the heading when the key changes (navigation between siblings)", () => {
    const { rerender, container } = render(<Heading ready={true} keyId="a" />)
    const heading = container.querySelector("h1")
    expect(document.activeElement).toBe(heading)

    // User moves focus elsewhere mid-page.
    const button = document.createElement("button")
    document.body.appendChild(button)
    button.focus()
    expect(document.activeElement).toBe(button)

    // Key changes — simulates personId switching from /profile/a to /profile/b.
    rerender(<Heading ready={true} keyId="b" text="Other Heading" />)
    expect(document.activeElement).toBe(container.querySelector("h1"))

    document.body.removeChild(button)
  })

  it("does not focus before the target is ready, even if `ready` flips back and forth", () => {
    const { rerender } = render(<Heading ready={false} keyId="a" />)
    rerender(<Heading ready={true} keyId="a" />)
    // After the first true→true transition, focus has fired. Toggling back
    // and forth should not re-fire focus on the same key.
    const button = document.createElement("button")
    document.body.appendChild(button)
    button.focus()
    rerender(<Heading ready={false} keyId="a" />)
    rerender(<Heading ready={true} keyId="a" />)
    expect(document.activeElement).toBe(button)
    document.body.removeChild(button)
  })

  it("treats `undefined` and `null` as distinct keys (refocuses across the transition)", () => {
    // Edge case: the consumer might pass `person?.id`, which is `undefined`
    // before data loads. Once the person object arrives, the key becomes the
    // real id. The hook must focus when ready flips true with the new key,
    // even though the initial key was `undefined`.
    const { rerender, container } = render(
      <Heading ready={false} keyId={undefined} />,
    )
    expect(document.activeElement).toBe(document.body)

    rerender(<Heading ready={true} keyId="p1" />)
    expect(document.activeElement).toBe(container.querySelector("h1"))
  })
})
