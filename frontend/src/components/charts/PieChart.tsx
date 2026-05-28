import { useMemo } from 'react'
import { formatGMD } from '../../lib/format'
import { EChartBase } from './EChartBase'

interface PieChartProps {
  data: {
    name: string
    value: number
  }[]
  height?: number | string
  isCurrency?: boolean
}

export function PieChart({
  data,
  height = 300,
  isCurrency = false,
}: PieChartProps) {
  const option = useMemo(() => {
    const colors = [
      '#2E6DB4',
      '#C8960C',
      '#1D9E75',
      '#7F77DD',
      '#D85A30',
      '#639922',
    ]
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const textColor = isDark ? '#9499aa' : '#888780'
    const tooltipBg = isDark ? '#1a1d27' : '#ffffff'
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
    const tooltipText = isDark ? '#e8eaf0' : '#1A1A2E'

    return {
      color: colors,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 0.5,
        textStyle: {
          color: tooltipText,
          fontSize: 13,
        },
        padding: [8, 12],
        borderRadius: 12,
        formatter: (params: any) => {
          const val = isCurrency
            ? formatGMD(params.value)
            : params.value.toLocaleString()
          return `${params.marker} ${params.name}<br/><b>${val}</b> (${params.percent}%)`
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        textStyle: {
          color: textColor,
          fontSize: 12,
        },
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [
        {
          name: 'Data',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: isDark ? '#0f1117' : '#ffffff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          data,
        },
      ],
    }
  }, [data, isCurrency])

  return <EChartBase option={option} height={height} />
}
