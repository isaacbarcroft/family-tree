"use client"

import { useEffect, useRef, type RefObject } from "react"

/**
 * Move keyboard focus to `ref.current` the first time it's mounted with a
 * given `id`, and again whenever `id` changes to a different non-empty value.
 *
 * Used to give keyboard / screen-reader users a sensible focus landing on
 * client-side navigations: after `router.push(...)` resolves, the new page's
 * main heading gets focus instead of focus snapping back to `<body>` (which
 * forces the user to Tab through the nav bar again).
 *
 * Pass `{ preventScroll: true }` to `focus()` so mouse users don't see a
 * scroll jump on initial load. The target element must be programmatically
 * focusable — typically that means a `tabIndex={-1}` on a heading.
 */
export function useFocusOnIdChange<T extends HTMLElement>(
  ref: RefObject<T | null>,
  id: string | null | undefined,
): void {
  const lastFocusedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    if (lastFocusedIdRef.current === id) return
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    lastFocusedIdRef.current = id
  }, [id, ref])
}
