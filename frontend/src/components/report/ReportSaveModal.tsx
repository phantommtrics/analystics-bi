import { useEffect, useState } from 'react'
import { LoadingButton } from '../ui/LoadingButton'
import {
  REPORT_CATEGORIES,
  type ReportCategory,
} from '../../lib/reportConstants'

interface ReportSaveModalProps {
  open: boolean
  title: string
  initialName: string
  initialDescription: string
  initialCategory: ReportCategory
  loading?: boolean
  onConfirm: (data: {
    name: string
    description: string
    category: ReportCategory
  }) => void
  onCancel: () => void
}

export function ReportSaveModal({
  open,
  title,
  initialName,
  initialDescription,
  initialCategory,
  loading = false,
  onConfirm,
  onCancel,
}: ReportSaveModalProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [category, setCategory] = useState<ReportCategory>(initialCategory)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setDescription(initialDescription)
    setCategory(initialCategory)
  }, [open, initialName, initialDescription, initialCategory])

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
        className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-bg-primary p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          SQL formatting and line breaks are preserved exactly as written in the editor.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Report name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              placeholder="e.g. Daily transaction summary"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              placeholder="What does this report show?"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Catalog category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            >
              {REPORT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-text-secondary">
              To show a composed view in the sidebar, use Dashboard Builder and enable sidebar
              menu there.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <LoadingButton variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </LoadingButton>
          <LoadingButton
            loading={loading}
            disabled={!name.trim()}
            onClick={() =>
              onConfirm({
                name: name.trim(),
                description: description.trim(),
                category,
              })
            }
          >
            Save report
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
