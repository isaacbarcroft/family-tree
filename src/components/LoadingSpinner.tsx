"use client"

interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="text-center py-16 text-gray-400 text-lg">{message}</div>
  )
}
