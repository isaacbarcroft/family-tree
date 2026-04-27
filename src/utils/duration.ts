export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00"
  const seconds = Math.floor(totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  const padded = remaining.toString().padStart(2, "0")
  return `${minutes}:${padded}`
}
