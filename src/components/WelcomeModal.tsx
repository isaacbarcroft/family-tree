"use client"

import { useState, useId, useSyncExternalStore } from "react"
import Modal from "@/components/Modal"

const WELCOME_SEEN_KEY = "family_legacy_welcome_seen"

// Subscribe to the welcome-seen flag in localStorage. We don't actually need
// cross-tab sync (the flag is set once and never cleared during a session), so
// the subscriber is a no-op. Routing the read through useSyncExternalStore
// avoids the React 19 set-state-in-effect anti-pattern while staying SSR-safe.
function subscribeWelcomeSeen() {
  return () => {}
}

function getWelcomeSeenSnapshot(): boolean {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(WELCOME_SEEN_KEY) !== null
}

function getWelcomeSeenServerSnapshot(): boolean {
  return true
}

const steps = [
  {
    title: "Welcome to Family Legacy",
    description:
      "A place to preserve your family's story for generations to come. Build your tree, save memories, and stay connected with the people who matter most.",
    icon: (
      <svg className="w-10 h-10 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    title: "Build Your Family Tree",
    description:
      "Start by adding yourself, then add your parents, siblings, spouse, and children. Each person has their own page with photos, birthdays, and a bio.",
    icon: (
      <svg className="w-10 h-10 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "Save Memories & Events",
    description:
      "Upload photos, write stories, and log important events like weddings, graduations, and reunions. Tag family members so nothing gets lost.",
    icon: (
      <svg className="w-10 h-10 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "You're All Set!",
    description:
      "Head to your dashboard to get started. Add a few family members, fill in your details, and start building your legacy.",
    icon: (
      <svg className="w-10 h-10 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function WelcomeModal() {
  const seen = useSyncExternalStore(
    subscribeWelcomeSeen,
    getWelcomeSeenSnapshot,
    getWelcomeSeenServerSnapshot,
  )
  const [dismissed, setDismissed] = useState(false)
  const [step, setStep] = useState(0)
  const titleId = useId()

  const visible = !seen && !dismissed

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WELCOME_SEEN_KEY, "1")
    }
    setDismissed(true)
  }

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
      return
    }
    dismiss()
  }

  const prev = () => {
    if (step > 0) setStep(step - 1)
  }

  if (!visible) return null

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <Modal
      onClose={dismiss}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      panelClassName="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl card-shadow overflow-hidden outline-none"
    >
      {/* Progress dots */}
      <div
        className="flex justify-center gap-2 pt-6 pb-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={step + 1}
        aria-label={`Step ${step + 1} of ${steps.length}`}
      >
        {steps.map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-gray-600"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="px-8 py-6 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center" aria-hidden="true">
            {current.icon}
          </div>
        </div>
        <h2 id={titleId} className="text-xl font-bold text-white mb-3">{current.title}</h2>
        <p className="text-gray-300 text-base leading-relaxed">{current.description}</p>
      </div>

      {/* Actions */}
      <div className="px-8 pb-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            onClick={prev}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Back
          </button>
        ) : (
          <button
            onClick={dismiss}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Skip
          </button>
        )}
        <button
          onClick={next}
          className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] font-medium text-sm transition min-w-[100px]"
        >
          {isLast ? "Get Started" : "Next"}
        </button>
      </div>
    </Modal>
  )
}
