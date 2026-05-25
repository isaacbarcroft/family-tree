"use client"

interface ConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
}

const baseButtonStyle = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  padding: "4px 10px",
  borderRadius: 6,
  lineHeight: 1.2,
} as const

export default function ConfirmDialog({
  onConfirm,
  onCancel,
  confirmLabel = "Yes",
  cancelLabel = "No",
}: ConfirmDialogProps) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg p-1"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <button
        type="button"
        onClick={onConfirm}
        className="confirm-dialog-btn"
        style={{
          ...baseButtonStyle,
          color: "var(--clay-deep)",
          fontWeight: 500,
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="confirm-dialog-btn"
        style={{
          ...baseButtonStyle,
          color: "var(--ink-2)",
        }}
      >
        {cancelLabel}
      </button>
    </div>
  )
}
