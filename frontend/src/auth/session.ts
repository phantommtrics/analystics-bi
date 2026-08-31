const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

const REFRESH_KEY = 'bi_refresh_token'
const LAST_ACTIVITY_KEY = 'bi_last_activity'

/** Log out after this much idle time. Activity (clicks, typing, API use) resets the timer. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
/** Refresh the access token this far before it expires so in-flight requests don't 401. */
const REFRESH_SKEW_MS = 2 * 60 * 1000

export type SessionTokens = {
  accessToken: string
  refreshToken: string
}

type SessionListener = (tokens: SessionTokens | null) => void

let accessToken: string | null = null
let refreshInFlight: Promise<SessionTokens | null> | null = null
let sessionGeneration = 0
const listeners = new Set<SessionListener>()

export function subscribeSession(listener: SessionListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(tokens: SessionTokens | null) {
  for (const listener of listeners) {
    listener(tokens)
  }
}

export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export function setSessionTokens(tokens: SessionTokens) {
  accessToken = tokens.accessToken
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  notify(tokens)
}

export function clearSession() {
  accessToken = null
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(LAST_ACTIVITY_KEY)
  notify(null)
}

export function touchActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

function getLastActivity(): number {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export function isIdleExpired(): boolean {
  const last = getLastActivity()
  if (!last) return false
  return Date.now() - last > IDLE_TIMEOUT_MS
}

function decodeExpiryMs(token: string): number | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(normalized)) as { exp?: number }
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

export function shouldRefreshAccessToken(token = accessToken): boolean {
  if (!token) return true
  const expiresAt = decodeExpiryMs(token)
  if (!expiresAt) return true
  return Date.now() >= expiresAt - REFRESH_SKEW_MS
}

function revokeRefreshToken(refreshToken: string) {
  void fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {
    /* session is already ending locally */
  })
}

export function expireSession() {
  sessionGeneration += 1
  const refreshToken = getRefreshToken()
  clearSession()
  if (refreshToken) {
    revokeRefreshToken(refreshToken)
  }
}

export async function refreshSession(): Promise<SessionTokens | null> {
  if (isIdleExpired()) {
    expireSession()
    return null
  }
  if (refreshInFlight) {
    return refreshInFlight
  }

  const generation = sessionGeneration
  refreshInFlight = (async () => {
    const existing = getRefreshToken()
    if (!existing) {
      return null
    }
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: existing }),
      })
      if (generation !== sessionGeneration) {
        return null
      }
      if (!response.ok) {
        expireSession()
        return null
      }
      const tokens = (await response.json()) as SessionTokens
      if (generation !== sessionGeneration) {
        return null
      }
      setSessionTokens(tokens)
      return tokens
    } catch {
      return null
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}
