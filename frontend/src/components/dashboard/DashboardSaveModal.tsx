import { useEffect, useState } from 'react'
import { LoadingButton } from '../ui/LoadingButton'
import {
  SIDEBAR_MENU_REPORT_CATEGORIES,
  isSidebarReportCategory,
  type SidebarReportCategory,
} from '../../lib/reportConstants'

interface DashboardSaveModalProps {
  open: boolean
  title: string
  initialName: string
  initialDescription: string
  initialShowInSidebarMenu: boolean
  initialSidebarCategory: SidebarReportCategory | null
  loading?: boolean
  onConfirm: (data: {
    name: string
    description: string
    showInSidebarMenu: boolean
    sidebarCategory: SidebarReportCategory | null
  }) => void
  onCancel: () => void
}

export function DashboardSaveModal({
  open,
  title,
  initialName,
  initialDescription,
  initialShowInSidebarMenu,
  initialSidebarCategory,
  loading = false,
  onConfirm,
  onCancel,
}: DashboardSaveModalProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [showInSidebarMenu, setShowInSidebarMenu] = useState(initialShowInSidebarMenu)
  const [sidebarSection, setSidebarSection] = useState<SidebarReportCategory>(
    initialSidebarCategory && isSidebarReportCategory(initialSidebarCategory)
      ? initialSidebarCategory
      : 'AGENTS',
  )

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setDescription(initialDescription)
    setShowInSidebarMenu(initialShowInSidebarMenu)
    if (initialSidebarCategory && isSidebarReportCategory(initialSidebarCategory)) {
      setSidebarSection(initialSidebarCategory)
    }
  }, [
    open,
    initialName,
    initialDescription,
    initialShowInSidebarMenu,
    initialSidebarCategory,
  ])

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
          Arrange saved reports on the canvas, then save. Published dashboards can appear in the
          sidebar under a section.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Dashboard name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              placeholder="e.g. Agent performance overview"
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
              placeholder="What does this dashboard show?"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3">
            <input
              type="checkbox"
              checked={showInSidebarMenu}
              onChange={(e) => setShowInSidebarMenu(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-text-primary">Show in sidebar menu</span>
              <span className="mt-0.5 block text-text-secondary">
                When published and assigned view permission, appears as a submenu under the
                selected section. Opens this dashboard layout (not individual reports).
              </span>
            </span>
          </label>

          {showInSidebarMenu && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Sidebar section</label>
              <select
                value={sidebarSection}
                onChange={(e) =>
                  setSidebarSection(e.target.value as SidebarReportCategory)
                }
                className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              >
                {SIDEBAR_MENU_REPORT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                showInSidebarMenu,
                sidebarCategory: showInSidebarMenu ? sidebarSection : null,
              })
            }
          >
            Save dashboard
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
