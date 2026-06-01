import { ReportCategory } from '@prisma/client'
import { SIDEBAR_CATEGORY_SECTION_MODULE } from '../reports/sidebarCategories.js'

export { SIDEBAR_CATEGORY_LABELS, SIDEBAR_REPORT_CATEGORIES } from '../reports/sidebarCategories.js'

export function normalizeDashboardSidebarMenu(
  showInSidebarMenu?: boolean,
  sidebarCategory?: ReportCategory | null,
): { showInSidebarMenu: boolean; sidebarCategory: ReportCategory | null } {
  if (!showInSidebarMenu) {
    return { showInSidebarMenu: false, sidebarCategory: null }
  }
  if (!sidebarCategory || !SIDEBAR_CATEGORY_SECTION_MODULE[sidebarCategory]) {
    return { showInSidebarMenu: false, sidebarCategory: null }
  }
  return { showInSidebarMenu: true, sidebarCategory }
}
