"use client"

import { useEffect, useId, useRef, useState } from "react"
import { addMemory } from "@/lib/db"
import { audioExtensionFor, uploadMemoryAudio, uploadMemoryPhoto } from "@/lib/storage"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import type { Person } from "@/models/Person"
import { convertHeicToJpeg, isHeicFile, isHeicFileByMagic } from "@/utils/heic"
import { formatDuration } from "@/utils/duration"
import { getErrorMessage } from "@/utils/errorMessage"
import { escapeLikePattern } from "@/utils/likeEscape"
import Modal from "@/components/Modal"

interface AddMemoryModalProps {
  onClose: () => void
  onCreated: () => void
  preTaggedPersonId?: string
}

export default function AddMemoryModal({ onClose, onCreated, preTaggedPersonId }: AddMemoryModalProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const previewsRef = useRef<string[]>([])
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [taggedPeople, setTaggedPeople] = useState<Person[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()

  type RecordingState = "idle" | "recording" | "ready"
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioMimeType, setAudioMimeType] = useState<string>("audio/webm")
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [recordingElapsed, setRecordingElapsed] = useState<number>(0)
  const [recorderError, setRecorderError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingStartRef = useRef<number>(0)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Pre-tag a person if provided
  useEffect(() => {
    if (preTaggedPersonId) {
      supabase
        .from("people")
        .select("*")
        .eq("id", preTaggedPersonId)
        .single()
        .then(({ data }) => {
          if (data) setTaggedPeople([data as Person])
        })
    }
  }, [preTaggedPersonId])

  // Search people
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    const term = escapeLikePattern(search.toLowerCase())
    supabase
      .from("people")
      .select("*")
      .ilike("searchName", `${term}%`)
      .limit(8)
      .then(({ data, error: err }) => {
        if (err) return
        const results = (data ?? []) as Person[]
        setSearchResults(results.filter((r) => !taggedPeople.some((t) => t.id === r.id)))
      })
  }, [search, taggedPeople])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const processed: File[] = []
    const newPreviews: string[] = []

    for (const file of selected) {
      let f = file
      const needsConversion = isHeicFile(file) || (await isHeicFileByMagic(file))
      if (needsConversion) {
        f = await convertHeicToJpeg(file)
      }
      processed.push(f)
      newPreviews.push(URL.createObjectURL(f))
    }

    setFiles((prev) => [...prev, ...processed])
    setPreviews((prev) => [...prev, ...newPreviews])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => {
      const removed = prev[index]
      if (removed) URL.revokeObjectURL(removed)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Keep a ref of outstanding preview blob URLs so unmount cleanup can revoke
  // them without re-subscribing every time the list changes.
  useEffect(() => {
    previewsRef.current = previews
  }, [previews])

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    audioUrlRef.current = audioUrl
  }, [audioUrl])

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current !== null) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const releaseAudioStream = () => {
    const stream = audioStreamRef.current
    if (!stream) return
    for (const track of stream.getTracks()) {
      track.stop()
    }
    audioStreamRef.current = null
  }

  const pickAudioMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "audio/webm"
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate
    }
    return "audio/webm"
  }

  const clearAudioRecording = () => {
    const url = audioUrlRef.current
    if (url) URL.revokeObjectURL(url)
    audioUrlRef.current = null
    setAudioBlob(null)
    setAudioUrl(null)
    setAudioDuration(0)
    setRecordingElapsed(0)
    setRecordingState("idle")
  }

  const startRecording = async () => {
    setRecorderError(null)

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecorderError("This browser does not support voice recording.")
      return
    }
    if (typeof MediaRecorder === "undefined") {
      setRecorderError("This browser does not support voice recording.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      const mimeType = pickAudioMimeType()
      setAudioMimeType(mimeType)

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      recordedChunksRef.current = []

      recorder.addEventListener("dataavailable", (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      })

      recorder.addEventListener("stop", () => {
        stopRecordingTimer()
        const elapsedMs = Date.now() - recordingStartRef.current
        const durationSec = Math.max(0, Math.round(elapsedMs / 1000))
        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        recordedChunksRef.current = []

        const previousUrl = audioUrlRef.current
        if (previousUrl) URL.revokeObjectURL(previousUrl)

        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        setAudioDuration(durationSec)
        setRecordingState("ready")
        releaseAudioStream()
      })

      recordingStartRef.current = Date.now()
      setRecordingElapsed(0)
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000)
        setRecordingElapsed(elapsed)
      }, 250)

      recorder.start()
      setRecordingState("recording")
    } catch (err) {
      console.error(err)
      releaseAudioStream()
      setRecorderError(getErrorMessage(err, "Could not access the microphone."))
      setRecordingState("idle")
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state === "inactive") return
    recorder.stop()
  }

  useEffect(() => {
    return () => {
      stopRecordingTimer()
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop()
        } catch {
          // already stopped
        }
      }
      releaseAudioStream()
      const url = audioUrlRef.current
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  const handleSubmit = async () => {
    if (!title.trim() || !user) return
    setSubmitting(true)
    setError(null)

    try {
      // Upload photos
      const creatorPersonId = taggedPeople[0]?.id ?? user.id
      const imageUrls: string[] = []
      for (const file of files) {
        const url = await uploadMemoryPhoto(creatorPersonId, file)
        imageUrls.push(url)
      }

      let uploadedAudioUrl: string | undefined
      let uploadedDuration: number | undefined
      if (audioBlob) {
        const ext = audioExtensionFor(audioMimeType)
        const audioFile = new File([audioBlob], `voice.${ext}`, { type: audioMimeType })
        uploadedAudioUrl = await uploadMemoryAudio(creatorPersonId, audioFile)
        uploadedDuration = audioDuration > 0 ? audioDuration : undefined
      }

      await addMemory({
        title: title.trim(),
        description: description.trim() || undefined,
        date: date || new Date().toISOString().split("T")[0],
        imageUrls,
        audioUrl: uploadedAudioUrl,
        durationSeconds: uploadedDuration,
        peopleIds: taggedPeople.map((p) => p.id),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      })

      onCreated()
      onClose()
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, "Failed to create memory. Please try again."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy={titleId}
      panelClassName="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg text-gray-100 shadow-lg max-h-[90vh] overflow-y-auto outline-none"
    >
      <h3 id={titleId} className="text-lg font-semibold mb-4 text-white">Add Memory</h3>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-4">
        <div>
          <label className="block text-base text-gray-300 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer BBQ 2024"
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
        </div>

        <div>
          <label className="block text-base text-gray-300 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
        </div>

        <div>
          <label className="block text-base text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Tell the story behind this memory..."
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-base text-gray-300 mb-1">Photos</label>
          <label className="inline-block bg-gray-700 hover:bg-gray-600 text-white text-base px-5 py-2.5 rounded-lg cursor-pointer font-medium min-h-[44px]">
            Choose Photos
            <input
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="w-full h-20 object-cover rounded" />
                  <button
                    onClick={() => removeFile(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute top-0 right-0 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Voice memory */}
        <div>
          <label className="block text-base text-gray-300 mb-1">Voice memory</label>
          {recorderError && (
            <p role="alert" className="text-red-400 text-sm mb-2">
              {recorderError}
            </p>
          )}
          {recordingState === "idle" && !audioUrl && (
            <button
              type="button"
              onClick={startRecording}
              className="bg-gray-700 hover:bg-gray-600 text-white text-base px-5 py-2.5 rounded-lg font-medium min-h-[44px]"
            >
              Record audio
            </button>
          )}
          {recordingState === "recording" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={stopRecording}
                className="bg-red-700 hover:bg-red-600 text-white text-base px-5 py-2.5 rounded-lg font-medium min-h-[44px]"
              >
                Stop recording
              </button>
              <span aria-live="polite" className="text-gray-300 text-sm">
                Recording {formatDuration(recordingElapsed)}
              </span>
            </div>
          )}
          {recordingState === "ready" && audioUrl && (
            <div className="space-y-2">
              <audio
                controls
                preload="metadata"
                src={audioUrl}
                aria-label="Recorded voice memory preview"
                className="w-full"
              />
              <div className="flex items-center gap-3">
                <span className="text-gray-300 text-sm">
                  Length {formatDuration(audioDuration)}
                </span>
                <button
                  type="button"
                  onClick={clearAudioRecording}
                  className="text-gray-400 hover:text-red-400 text-sm px-2 py-1 rounded-lg hover:bg-gray-700 transition"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={startRecording}
                  className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-gray-700 transition"
                >
                  Re-record
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tag People */}
        <div>
          <label className="block text-base text-gray-300 mb-1">Tag People</label>
          {taggedPeople.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {taggedPeople.map((p) => (
                <span
                  key={p.id}
                  className="bg-[var(--accent)] text-white text-sm px-2.5 py-1 rounded-full flex items-center gap-1"
                >
                  {p.firstName} {p.lastName}
                  <button
                    onClick={() => setTaggedPeople((prev) => prev.filter((t) => t.id !== p.id))}
                    aria-label={`Untag ${p.firstName} ${p.lastName}`}
                    className="hover:text-red-300"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for people to tag..."
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
          {searchResults.length > 0 && (
            <ul className="mt-1 max-h-32 overflow-y-auto border border-gray-700 rounded bg-gray-800">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTaggedPeople((prev) => [...prev, r])
                      setSearch("")
                    }}
                    className="w-full text-left p-2.5 hover:bg-gray-700 text-base"
                  >
                    {r.firstName} {r.lastName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
        >
          {submitting ? "Saving..." : "Save Memory"}
        </button>
      </div>
    </Modal>
  )
}
