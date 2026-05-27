"use client"

import { type RefObject, useEffect, useRef } from "react"

// Move keyboard focus to the referenced element the first time `ready` is
// true for a given `key`. Used to land focus on a page's main heading after
// client-side navigation so screen-reader and keyboard users do not start
// back at the top of the document. Target needs `tabIndex={-1}` so
// `.focus()` succeeds on a non-interactive element. Subsequent re-renders
// while `key` is unchanged are no-ops (mid-edit data refresh does not steal
// focus); when `key` changes, focus moves to the new heading.
export function useFocusOnFirstReady<T extends HTMLElement>(
  ready: boolean,
  key: unknown,
): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const focusedKeyRef = useRef<unknown>(undefined)

  useEffect(() => {
    if (!ready) return
    if (focusedKeyRef.current === key) return
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    focusedKeyRef.current = key
  }, [ready, key])

  return ref
}
