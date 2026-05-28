export const formatGMD = (value: number): string => {
  return `GMD ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const formatNumber = (value: number): string => {
  return value.toLocaleString('en-US')
}

export const formatPercent = (value: number): string => {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const formatTimeAgo = (minutes: number): string => {
  if (minutes < 1) return 'Just now'
  if (minutes === 1) return '1 min ago'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1 hour ago'
  return `${hours} hours ago`
}
