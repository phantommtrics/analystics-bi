import type { AuthUser } from './types'
import { API_BASE, apiFetch } from '../api/client'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  if (!response.ok) {
    throw new Error('Invalid credentials')
  }
  return response.json()
}

export async function me(accessToken: string): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', accessToken)
}

export async function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  return apiFetch('/auth/change-password', accessToken, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
