"use client"

import Link from "next/link"
import { useEffect } from "react"

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RouteError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Route error boundary caught:", error)
  }, [error])

  const isDev = process.env.NODE_ENV !== "production"

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-[50vh] flex items-center justify-center p-6"
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center max-w-md w-full">
        <h2 className="text-xl font-semibold text-white mb-2">
          Something went wrong on this page
        </h2>
        <p className="text-gray-300 text-base mb-4">
          An unexpected error occurred. You can try again, or head home and come
          back to it.
        </p>
        {isDev && error?.message ? (
          <pre className="text-left text-xs text-red-300 bg-black/40 border border-red-900/40 rounded-lg p-3 mb-4 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        ) : null}
        {!isDev && error?.digest ? (
          <p className="text-gray-500 text-xs mb-4">
            Reference: <code className="text-gray-400">{error.digest}</code>
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition inline-flex items-center justify-center"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
