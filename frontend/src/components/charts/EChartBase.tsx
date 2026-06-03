import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export type EChartHandle = {
  getDataUrl: () => string | null
}

interface EChartBaseProps {
  option: unknown
  className?: string
  height?: string | number
}

export const EChartBase = forwardRef<EChartHandle, EChartBaseProps>(function EChartBase(
  { option, className = '', height = 300 },
  ref,
) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<any>(null)

  useImperativeHandle(
    ref,
    () => ({
      getDataUrl: () => {
        if (!chartInstance.current) return null
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
        return chartInstance.current.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: isDark ? '#1a1d27' : '#ffffff',
        })
      },
    }),
    [],
  )

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
})
