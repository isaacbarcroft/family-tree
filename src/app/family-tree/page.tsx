"use client"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function FamilyTreePage() {
  return (
   <ProtectedRoute>
      <h1 className="text-2xl font-bold">Family Tree</h1>
      <p>This is where the family tree will be rendered.</p>
    </ProtectedRoute>
  )
}