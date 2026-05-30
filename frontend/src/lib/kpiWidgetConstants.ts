/** Curated Tabler icons for KPI cards (class suffix after `ti `). */
export const KPI_ICON_OPTIONS = [
  { value: 'ti-chart-bar', label: 'Bar chart' },
  { value: 'ti-chart-line', label: 'Line chart' },
  { value: 'ti-chart-pie', label: 'Pie chart' },
  { value: 'ti-activity', label: 'Activity' },
  { value: 'ti-building-bank', label: 'Bank' },
  { value: 'ti-receipt', label: 'Receipt' },
  { value: 'ti-users', label: 'Users' },
  { value: 'ti-wallet', label: 'Wallet' },
  { value: 'ti-coin', label: 'Coin' },
  { value: 'ti-trending-up', label: 'Trending up' },
  { value: 'ti-shield-check', label: 'Shield' },
  { value: 'ti-report', label: 'Report' },
] as const

export const KPI_COLOR_PRESETS = [
  { name: 'Blue', backgroundColor: '#1e3a5f', textColor: '#ffffff' },
  { name: 'Gold', backgroundColor: '#5c4a14', textColor: '#f5e6a3' },
  { name: 'Green', backgroundColor: '#14532d', textColor: '#bbf7d0' },
  { name: 'Purple', backgroundColor: '#3b0764', textColor: '#e9d5ff' },
  { name: 'Slate', backgroundColor: '#1e293b', textColor: '#f1f5f9' },
  { name: 'Light', backgroundColor: '#f1f5f9', textColor: '#0f172a' },
] as const

export const DEFAULT_KPI_WIDGET = {
  label: 'KPI label',
  value: '0',
  icon: 'ti-chart-bar',
  backgroundColor: '#1e3a5f',
  textColor: '#ffffff',
} as const

export function normalizeIconClass(icon: string): string {
  const trimmed = icon.trim()
  if (!trimmed) return 'ti-chart-bar'
  if (trimmed.startsWith('ti ')) return trimmed.slice(3).startsWith('ti-') ? trimmed.slice(3) : trimmed
  if (trimmed.startsWith('ti-')) return trimmed
  return `ti-${trimmed}`
}

export function iconClassName(icon: string): string {
  const normalized = normalizeIconClass(icon)
  return normalized.startsWith('ti-') ? `ti ${normalized}` : `ti ti-${normalized}`
}

export function normalizeHexColor(value: string, fallback: string): string {
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  }
  return fallback
}
