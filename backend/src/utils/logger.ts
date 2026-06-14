function timestamp() {
  return new Date().toISOString()
}

export function log(tag: string, message: string, ...args: unknown[]) {
  console.log(`[${timestamp()}] [${tag}] ${message}`, ...args)
}

export function logError(tag: string, message: string, ...args: unknown[]) {
  console.error(`[${timestamp()}] [${tag}] ${message}`, ...args)
}

export function truncateSql(sql: string, maxLen = 120) {
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}
