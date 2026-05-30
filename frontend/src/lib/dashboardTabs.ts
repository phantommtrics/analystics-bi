import type { DashboardDetail } from '../api/dashboards'
import { emptyDashboardLayout, type DashboardLayout } from './dashboardLayout'

export type DashboardEditorSnapshot = {
  name: string
  description: string
  layout: DashboardLayout
}

export type DashboardTab = {
  id: string
  title: string
  savedDashboardId: string | null
  name: string
  description: string
  layout: DashboardLayout
  isPublished: boolean
  savedSnapshot: DashboardEditorSnapshot | null
}

let tabSeq = 0

export function createDashboardTab(
  opts?: Partial<
    Pick<
      DashboardTab,
      | 'title'
      | 'name'
      | 'description'
      | 'layout'
      | 'savedDashboardId'
      | 'isPublished'
      | 'savedSnapshot'
    >
  >,
): DashboardTab {
  tabSeq += 1
  const n = tabSeq
  const layout = opts?.layout ?? emptyDashboardLayout()
  return {
    id: `dash-tab-${n}-${Date.now()}`,
    title: opts?.title ?? `Dashboard ${n}`,
    savedDashboardId: opts?.savedDashboardId ?? null,
    name: opts?.name ?? 'Untitled dashboard',
    description: opts?.description ?? '',
    layout,
    isPublished: opts?.isPublished ?? false,
    savedSnapshot: opts?.savedSnapshot ?? null,
  }
}

export function dashboardTabFromDetail(dashboard: DashboardDetail): DashboardTab {
  const description = dashboard.description ?? ''
  const snapshot: DashboardEditorSnapshot = {
    name: dashboard.name,
    description,
    layout: dashboard.layout,
  }
  return createDashboardTab({
    title: dashboard.name,
    savedDashboardId: dashboard.id,
    name: dashboard.name,
    description,
    layout: dashboard.layout,
    isPublished: dashboard.isPublished,
    savedSnapshot: snapshot,
  })
}

export function duplicateTabTitle(existing: string[], base: string) {
  let title = `${base} (copy)`
  let i = 2
  while (existing.includes(title)) {
    title = `${base} (copy ${i})`
    i += 1
  }
  return title
}

export function isDashboardTabDirty(tab: DashboardTab): boolean {
  if (!tab.savedSnapshot) return true
  const s = tab.savedSnapshot
  return (
    tab.name !== s.name ||
    tab.description !== s.description ||
    JSON.stringify(tab.layout) !== JSON.stringify(s.layout)
  )
}
