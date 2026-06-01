import { ReportVisualization } from '@prisma/client'
import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')

const widgetBaseSchema = z.object({
  id: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(24),
})

export const reportWidgetSchema = widgetBaseSchema.extend({
  type: z.literal('report').optional(),
  savedReportId: z.string().min(1),
  visualization: z.nativeEnum(ReportVisualization).optional(),
})

export const kpiWidgetSchema = widgetBaseSchema.extend({
  type: z.literal('kpi'),
  label: z.string().min(1).max(200),
  value: z.string().max(100),
  icon: z.string().min(1).max(80),
  backgroundColor: hexColor,
  textColor: hexColor,
  savedReportId: z.string().min(1).optional(),
  labelColumn: z.string().min(1).max(200).optional(),
  valueColumn: z.string().min(1).max(200).optional(),
  rowIndex: z.number().int().min(0).optional(),
})

export const dashboardWidgetSchema = z.union([kpiWidgetSchema, reportWidgetSchema])

export const dashboardLayoutSchema = z.object({
  gridCols: z.number().int().min(4).max(24).default(12),
  rowHeight: z.number().int().min(20).max(200).default(80),
  widgets: z.array(dashboardWidgetSchema),
})

export type ReportWidgetLayout = z.infer<typeof reportWidgetSchema>
export type KpiWidgetLayout = z.infer<typeof kpiWidgetSchema>
export type DashboardWidgetLayout = z.infer<typeof dashboardWidgetSchema>
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>

export const emptyDashboardLayout = (): DashboardLayout => ({
  gridCols: 12,
  rowHeight: 80,
  widgets: [],
})

export function parseDashboardLayout(value: unknown): DashboardLayout {
  const parsed = dashboardLayoutSchema.safeParse(value)
  if (parsed.success) {
    return parsed.data
  }
  return emptyDashboardLayout()
}

export function isKpiWidget(widget: DashboardWidgetLayout): widget is KpiWidgetLayout {
  return widget.type === 'kpi'
}

export function isReportWidget(widget: DashboardWidgetLayout): widget is ReportWidgetLayout {
  return !isKpiWidget(widget)
}

export function extractReportIdsFromLayout(layout: DashboardLayout): string[] {
  return [
    ...new Set([
      ...layout.widgets.filter(isReportWidget).map((w) => w.savedReportId),
      ...layout.widgets
        .filter(isKpiWidget)
        .map((w) => w.savedReportId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ]
}
