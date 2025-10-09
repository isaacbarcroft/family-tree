"use client"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function MemoriesPage() {
  return (
    <ProtectedRoute>
      <h1 className="text-2xl font-bold">Memories</h1>
      <p>Photos, stories, and family moments.</p>
    </ProtectedRoute>
  )
}
