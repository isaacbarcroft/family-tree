"use client"

import { useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function SeedPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [result, setResult] = useState<string>("")

  const handleAction = async (method: "POST" | "DELETE") => {
    setStatus("loading")
    setResult("")

    try {
      const res = await fetch("/api/seed", { method })
      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setResult(data.error || "Unknown error")
        return
      }

      setStatus("success")
      if (method === "POST") {
        setResult(
          `Created: ${data.created.people} people, ${data.created.families} families, ${data.created.events} events, ${data.created.memories} memories`
        )
        return
      }
      setResult(
        `Removed: ${data.deleted.people} people, ${data.deleted.families} families, ${data.deleted.events} events, ${data.deleted.memories} memories`
      )
    } catch (err) {
      setStatus("error")
      setResult(String(err))
    }
  }

  return (
    <ProtectedRoute>
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-white mb-4">Seed Data</h1>
        <p className="text-gray-300 text-base mb-6">
          Insert or remove sample data: 16 people across 3 generations,
          3 families, 10 events, and 5 memories. Seeding is idempotent —
          running it again updates existing records rather than creating duplicates.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleAction("POST")}
            disabled={status === "loading"}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white px-6 py-3 rounded-lg text-base font-medium min-h-[44px] transition"
          >
            {status === "loading" ? "Working..." : "Seed Database"}
          </button>
          <button
            onClick={() => handleAction("DELETE")}
            disabled={status === "loading"}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg text-base font-medium min-h-[44px] transition"
          >
            {status === "loading" ? "Working..." : "Remove Seed Data"}
          </button>
        </div>

        {status === "success" && (
          <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-base">
            {result}
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-base">
            Error: {result}
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
