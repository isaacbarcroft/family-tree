"use client"

import { useEffect, useRef, type ReactNode } from "react"

interface ModalProps {
  onClose: () => void
  children: ReactNode
  /**
   * DOM id of the element that labels this dialog (usually the heading).
   * Pass either `labelledBy` or `ariaLabel`, whichever fits the modal.
   */
  labelledBy?: string
  ariaLabel?: string
  /** If false, pressing Escape does not close the modal. Defaults to true. */
  closeOnEscape?: boolean
  /** Optional className for the dialog panel. Defaults to the app's standard dark card. */
  panelClassName?: string
  /** Optional className for the backdrop wrapper. */
  backdropClassName?: string
}

const DEFAULT_BACKDROP =
  "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"

const DEFAULT_PANEL =
  "bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md text-gray-100 shadow-lg max-h-[90vh] overflow-y-auto outline-none"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ")

function getFocusable(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  return Array.from(nodes).filter((node) => {
    if (node.hasAttribute("disabled")) return false
    if (node.hasAttribute("hidden")) return false
    if (node.getAttribute("aria-hidden") === "true") return false
    return true
  })
}

export default function Modal({
  onClose,
  children,
  labelledBy,
  ariaLabel,
  closeOnEscape = true,
  panelClassName,
  backdropClassName,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    if (!panel) return

    // If the content has already autofocused something inside the dialog, respect it.
    if (panel.contains(document.activeElement) && document.activeElement !== panel) {
      return
    }

    const first = getFocusable(panel)[0]
    if (first) {
      first.focus()
      return
    }
    panel.focus()
  }, [])

  useEffect(() => {
    return () => {
      const previous = previouslyFocusedRef.current
      if (previous && typeof previous.focus === "function") {
        previous.focus()
      }
    }
  }, [])

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  useEffect(() => {
    if (!closeOnEscape) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [closeOnEscape, onClose])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return
    const panel = panelRef.current
    if (!panel) return

    const focusable = getFocusable(panel)
    if (focusable.length === 0) {
      e.preventDefault()
      panel.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement as HTMLElement | null

    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault()
      last.focus()
      return
    }
    if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={backdropClassName ?? DEFAULT_BACKDROP}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={panelClassName ?? DEFAULT_PANEL}
      >
        {children}
      </div>
    </div>
  )
}
