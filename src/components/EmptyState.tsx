"use client"

import Link from "next/link"

interface EmptyStateProps {
  message: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export default function EmptyState({ message, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
      <p className="text-gray-400 text-lg mb-2">{message}</p>
      {description && <p className="text-gray-300 text-base mb-4">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
