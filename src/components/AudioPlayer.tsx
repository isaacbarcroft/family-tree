"use client"

import { formatDuration } from "@/utils/duration"

interface AudioPlayerProps {
  src: string
  durationSeconds?: number
  label?: string
  className?: string
}

export default function AudioPlayer({
  src,
  durationSeconds,
  label = "Voice memory",
  className,
}: AudioPlayerProps) {
  return (
    <div
      className={
        className ??
        "flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg p-3"
      }
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 mb-1">
          {label}
          {durationSeconds !== undefined && durationSeconds > 0 && (
            <span className="text-gray-400 ml-2">
              {formatDuration(durationSeconds)}
            </span>
          )}
        </p>
        <audio
          controls
          preload="metadata"
          src={src}
          aria-label={label}
          className="w-full"
        >
          Your browser does not support audio playback.
        </audio>
      </div>
    </div>
  )
}
