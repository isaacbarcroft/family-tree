"use client"

interface ConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
}

export default function ConfirmDialog({
  onConfirm,
  onCancel,
  confirmLabel = "Yes",
  cancelLabel = "No",
}: ConfirmDialogProps) {
  return (
    <div className="flex gap-1 bg-gray-950 rounded-lg p-1">
      <button
        onClick={onConfirm}
        className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-gray-800 transition"
      >
        {confirmLabel}
      </button>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800 transition"
      >
        {cancelLabel}
      </button>
    </div>
  )
}
