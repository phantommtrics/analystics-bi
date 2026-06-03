import { forwardRef, useMemo } from 'react'
import { EChartBase, type EChartHandle } from './EChartBase'

interface LineChartProps {
  data: {
    labels: string[]
    series: {
      name: string
      data: number[]
    }[]
  }
  height?: number | string
  smooth?: boolean
  area?: boolean
}

export const LineChart = forwardRef<EChartHandle, LineChartProps>(function LineChart(
  { data, height = 300, smooth = true, area = false },
  ref,
) {
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
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    const tooltipBg = isDark ? '#1a1d27' : '#ffffff'
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
    const tooltipText = isDark ? '#e8eaf0' : '#1A1A2E'

    return {
      color: colors,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 0.5,
        textStyle: {
          color: tooltipText,
          fontSize: 13,
        },
        padding: [8, 12],
        borderRadius: 12,
      },
      legend: {
        data: data.series.map((s) => s.name),
        bottom: 0,
        textStyle: {
          color: textColor,
          fontSize: 12,
        },
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.labels,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          margin: 12,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: gridColor,
            width: 0.5,
          },
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000000) return `${value / 1000000}M`
            if (value >= 1000) return `${value / 1000}k`
            return value
          },
        },
      },
      series: data.series.map((s, i) => ({
        name: s.name,
        type: 'line',
        smooth,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: {
          width: 2,
        },
        areaStyle: area
          ? {
              opacity: 0.1,
              color: colors[i % colors.length],
            }
          : undefined,
        data: s.data,
      })),
    }
  }, [data, smooth, area])

  return <EChartBase ref={ref} option={option} height={height} />
})
