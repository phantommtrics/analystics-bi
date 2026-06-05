import type { StatementDetail } from '../api/statements'
import type { ReportCategory } from './reportConstants'
import {
  emptyConfigForType,
  type StatementConfig,
  type StatementType,
} from './statementConfig'

export type StatementEditorSnapshot = {
  name: string
  description: string
  category: ReportCategory
  type: StatementType
  config: StatementConfig
}

export type StatementTab = {
  id: string
  title: string
  savedStatementId: string | null
  name: string
  description: string
  category: ReportCategory
  type: StatementType
  config: StatementConfig
  isPublished: boolean
  savedSnapshot: StatementEditorSnapshot | null
}

let tabSeq = 0

export function createStatementTab(
  type: StatementType,
  opts?: Partial<
    Pick<
      StatementTab,
      | 'title'
      | 'name'
      | 'description'
      | 'category'
      | 'config'
      | 'savedStatementId'
      | 'isPublished'
      | 'savedSnapshot'
    >
  >,
): StatementTab {
  tabSeq += 1
  const n = tabSeq
  return {
    id: `stmt-tab-${n}-${Date.now()}`,
    title: opts?.title ?? `Statement ${n}`,
    savedStatementId: opts?.savedStatementId ?? null,
    name: opts?.name ?? 'New Statement',
    description: opts?.description ?? '',
    category: opts?.category ?? 'GENERAL',
    type,
    config: opts?.config ?? emptyConfigForType(type),
    isPublished: opts?.isPublished ?? false,
    savedSnapshot: opts?.savedSnapshot ?? null,
  }
}

export function statementTabFromDetail(detail: StatementDetail): StatementTab {
  const description = detail.description ?? ''
  const snapshot: StatementEditorSnapshot = {
    name: detail.name,
    description,
    category: detail.category,
    type: detail.type,
    config: detail.config,
  }
  return createStatementTab(detail.type, {
    title: detail.name,
    savedStatementId: detail.id,
    name: detail.name,
    description,
    category: detail.category,
    config: detail.config,
    isPublished: detail.isPublished,
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

export function isStatementTabDirty(tab: StatementTab): boolean {
  if (!tab.savedSnapshot) return true
  return (
    JSON.stringify({
      name: tab.name,
      description: tab.description,
      category: tab.category,
      type: tab.type,
      config: tab.config,
    }) !== JSON.stringify(tab.savedSnapshot)
  )
}
