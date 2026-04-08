"use client"

interface SkeletonProps {
  className?: string
}

export function SkeletonLine({ className = "" }: SkeletonProps) {
  return <div className={`skeleton h-4 ${className}`} />
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 ${className}`}>
      <SkeletonLine className="w-1/3 mb-3" />
      <SkeletonLine className="w-full mb-2" />
      <SkeletonLine className="w-2/3" />
    </div>
  )
}

export function SkeletonAvatar({ className = "" }: SkeletonProps) {
  return <div className={`skeleton rounded-full w-10 h-10 ${className}`} />
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
      <SkeletonAvatar />
      <div className="flex-1">
        <SkeletonLine className="w-1/3 mb-2" />
        <SkeletonLine className="w-1/5 h-3" />
      </div>
    </div>
  )
}

export function SkeletonPage({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  )
}
