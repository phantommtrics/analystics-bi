interface AlertModalProps {
  open: boolean
  title: string
  message: string
  tone?: 'error' | 'info'
  confirmLabel?: string
  onClose: () => void
}

export function AlertModal({
  open,
  title,
  message,
  tone = 'error',
  confirmLabel = 'Got it',
  onClose,
}: AlertModalProps) {
  if (!open) return null

  const icon =
    tone === 'error' ? (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-semantic-red/10 text-semantic-red">
        <i className="ti ti-alert-circle text-xl" />
      </div>
    ) : (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
        <i className="ti ti-info-circle text-xl" />
      </div>
    )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-bg-primary p-6 shadow-xl"
      >
        <div className="flex gap-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id="alert-modal-title" className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-blue"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
