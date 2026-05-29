import { LoadingButton } from './LoadingButton'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={loading ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-bg-primary p-6 shadow-xl"
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm text-text-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <LoadingButton
            type="button"
            loading={loading}
            variant={variant}
            onClick={onConfirm}
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
