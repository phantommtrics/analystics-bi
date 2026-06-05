import { useEffect, useState } from 'react'
import { LoadingButton } from '../ui/LoadingButton'
import { REPORT_CATEGORIES, type ReportCategory } from '../../lib/reportConstants'
import { STATEMENT_TYPES } from '../../lib/statementConstants'
import type { StatementType } from '../../lib/statementConfig'

interface StatementSaveModalProps {
  open: boolean
  title: string
  initialName: string
  initialDescription: string
  initialCategory: ReportCategory
  initialType: StatementType
  allowTypeChange?: boolean
  loading?: boolean
  onConfirm: (data: {
    name: string
    description: string
    category: ReportCategory
    type: StatementType
  }) => void
  onCancel: () => void
}

export function StatementSaveModal({
  open,
  title,
  initialName,
  initialDescription,
  initialCategory,
  initialType,
  allowTypeChange = false,
  loading = false,
  onConfirm,
  onCancel,
}: StatementSaveModalProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [category, setCategory] = useState<ReportCategory>(initialCategory)
  const [type, setType] = useState<StatementType>(initialType)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setDescription(initialDescription)
    setCategory(initialCategory)
    setType(initialType)
  }, [open, initialName, initialDescription, initialCategory, initialType])

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
          Configure the statement metadata. Bind reports and column mappings before saving.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
              placeholder="Statement name"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
              placeholder="Optional description"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
              className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
            >
              {REPORT_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {allowTypeChange && (
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">Statement type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as StatementType)}
                className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
              >
                {STATEMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-sm px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <LoadingButton
            loading={loading}
            disabled={!name.trim()}
            onClick={() =>
              onConfirm({
                name: name.trim(),
                description: description.trim(),
                category,
                type,
              })
            }
          >
            Save
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
