import { forwardRef } from 'react'
import { BarChart } from '../charts/BarChart'
import { LineChart } from '../charts/LineChart'
import { PieChart } from '../charts/PieChart'
import type { EChartHandle } from '../charts/EChartBase'
import type { ReportVisualization } from '../../lib/reportConstants'
import type { ChartPreviewData, PieSlice } from '../../lib/queryResultChart'

interface ReportChartPreviewProps {
  visualization: ReportVisualization
  chartData: ChartPreviewData
  pieData: PieSlice[]
  height?: number | string
}

export const ReportChartPreview = forwardRef<EChartHandle, ReportChartPreviewProps>(
  function ReportChartPreview(
    { visualization, chartData, pieData, height = 280 },
    ref,
  ) {
    if (chartData.series.length === 0 && pieData.length === 0) {
      return (
        <div className="flex h-full min-h-[160px] items-center justify-center rounded-md border border-dashed border-border bg-bg-primary px-4 text-center text-sm text-text-secondary">
          No numeric data available for this chart type.
        </div>
      )
    }

    switch (visualization) {
      case 'LINE_CHART':
        return <LineChart ref={ref} data={chartData} height={height} smooth area />
      case 'PIE_CHART':
        return <PieChart ref={ref} data={pieData} height={height} />
      case 'BAR_CHART':
      default:
        return <BarChart ref={ref} data={chartData} height={height} />
    }
  },
)
