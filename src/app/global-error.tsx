"use client"

import { useEffect } from "react"

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Global error boundary caught:", error)
  }, [error])

  const isDev = process.env.NODE_ENV !== "production"

  return (
    <html lang="en">
      <body
        style={{
          background: "#0c0f17",
          color: "#e8e6e3",
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          style={{
            background: "#141821",
            border: "1px solid #1e2433",
            borderRadius: "0.75rem",
            padding: "2rem",
            textAlign: "center",
            maxWidth: "28rem",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "0.5rem" }}>
            The app couldn&apos;t load
          </h1>
          <p style={{ color: "#cbd0d8", marginBottom: "1rem" }}>
            A critical error prevented this page from rendering. Try reloading;
            if it keeps happening, contact Isaac with the reference below.
          </p>
          {isDev && error?.message ? (
            <pre
              style={{
                textAlign: "left",
                fontSize: "0.75rem",
                color: "#fca5a5",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(127, 29, 29, 0.4)",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                marginBottom: "1rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </pre>
          ) : null}
          {!isDev && error?.digest ? (
            <p style={{ color: "#6b7280", fontSize: "0.75rem", marginBottom: "1rem" }}>
              Reference: <code style={{ color: "#9ca3af" }}>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#c4956a",
              color: "#fff",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 500,
              minHeight: "44px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
