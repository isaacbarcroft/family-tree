"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { MAIN_LANDMARK_ID } from "@/config/constants"

/**
 * Move keyboard / screen-reader focus to the <main> landmark after every
 * client-side route change.
 *
 * Why: in a Next.js App Router SPA, navigation does not reset focus the way
 * a full page load does. After `router.push("/profile/[id]")`, the user's
 * focus stays on the now-replaced element (or is lost entirely), so keyboard
 * users have to Tab from wherever they happened to be — typically the top of
 * the document — to find anything on the new page.
 *
 * Renders nothing. The matching <main id={MAIN_LANDMARK_ID} tabIndex={-1}>
 * lives in src/app/layout.tsx; the suppressed focus ring on it is in
 * globals.css.
 */
export function RouteFocusManager() {
  const pathname = usePathname()
  const previousPathname = useRef<string | null>(null)

  useEffect(() => {
    // Skip the initial mount — the browser handles initial focus on full
    // page loads, and re-focusing <main> would surprise the user.
    if (previousPathname.current === null) {
      previousPathname.current = pathname
      return
    }

    if (previousPathname.current === pathname) return
    previousPathname.current = pathname

    const main = document.getElementById(MAIN_LANDMARK_ID)
    if (!(main instanceof HTMLElement)) return

    // preventScroll keeps the browser's normal scroll-to-top behavior owned
    // by Next.js's router, rather than the focus call yanking the viewport.
    main.focus({ preventScroll: true })
  }, [pathname])

  return null
}
