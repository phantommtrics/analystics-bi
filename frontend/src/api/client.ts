import {
  expireSession,
  getAccessToken,
  refreshSession,
  shouldRefreshAccessToken,
  touchActivity,
} from '../auth/session'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

async function authorizedFetch(path: string, token: string, options: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}

/** Authenticated fetch that refreshes the session on 401 and retries once. */
export async function apiRequest(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  let token = getAccessToken() ?? accessToken
  if (!token) {
    expireSession()
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (shouldRefreshAccessToken(token)) {
    const refreshed = await refreshSession()
    if (refreshed) {
      token = refreshed.accessToken
    }
  }

  let response = await authorizedFetch(path, token, options)
  if (response.status === 401) {
    const refreshed = await refreshSession()
    if (!refreshed) {
      return response
    }
    response = await authorizedFetch(path, refreshed.accessToken, options)
  }

  if (response.ok) {
    touchActivity()
  }

  return response
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiRequest(path, accessToken, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Request failed')
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}
