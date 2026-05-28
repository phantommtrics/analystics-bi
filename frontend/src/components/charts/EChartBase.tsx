import { useEffect, useRef } from 'react'

interface EChartBaseProps {
  option: unknown
  className?: string
  height?: string | number
}

export function EChartBase({
  option,
  className = '',
  height = 300,
}: EChartBaseProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<any>(null)

  useEffect(() => {
    if (!(window as any).echarts) {
      console.error('ECharts is not loaded. Ensure the CDN script is included.')
      return
    }

    if (!chartRef.current) return

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    chartInstance.current = (window as any).echarts.init(
      chartRef.current,
      isDark ? 'dark' : null,
    )
    chartInstance.current.setOption(option)

    const handleResize = () => {
      chartInstance.current?.resize()
    }

    const handleThemeChange = () => {
      if (!chartRef.current || !chartInstance.current) return

      chartInstance.current.dispose()
      const isDarkNow =
        document.documentElement.getAttribute('data-theme') === 'dark'
      chartInstance.current = (window as any).echarts.init(
        chartRef.current,
        isDarkNow ? 'dark' : null,
      )
      chartInstance.current.setOption(option)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('themechange', handleThemeChange)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('themechange', handleThemeChange)
      chartInstance.current?.dispose()
    }
  }, [option])

  return (
    <div
      ref={chartRef}
      className={className}
      style={{
        height,
        width: '100%',
      }}
    />
  )
}
