import { formatGMD, formatNumber, formatPercent } from '../../lib/format'

interface KpiCardProps {
  label: string
  value: number
  trend: number
  isCurrency?: boolean
  icon: string
  className?: string
}

export function KpiCard({
  label,
  value,
  trend,
  isCurrency = false,
  icon,
  className = '',
}: KpiCardProps) {
  const isPositive = trend > 0
  const isNegative = trend < 0
  const trendColor = isPositive
    ? 'text-semantic-green'
    : isNegative
      ? 'text-semantic-red'
      : 'text-semantic-gray'
  const trendIcon = isPositive ? '▲' : isNegative ? '▼' : '—'

  return (
    <div
      className={`flex flex-col gap-3 rounded p-4 bg-bg-secondary dark:bg-[#1e2533] ${className}`}
    >
      <div className="flex items-start justify-between">
        <i className={`ti ${icon} text-[22px] text-brand-blue`}></i>
        <div
          className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}
        >
          <span>{trendIcon}</span>
          <span>{formatPercent(Math.abs(trend))}</span>
        </div>
      </div>
      <div>
        <div className="mb-1 text-kpi font-medium text-text-primary">
          {isCurrency ? formatGMD(value) : formatNumber(value)}
        </div>
        <div className="text-sm text-text-secondary">{label}</div>
      </div>
    </div>
  )
}
