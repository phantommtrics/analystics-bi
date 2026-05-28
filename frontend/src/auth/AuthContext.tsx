import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { login as loginRequest, me, refresh as refreshRequest } from './api'
import type { AuthUser } from './types'

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (moduleKey: string, actionKey?: string) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const REFRESH_KEY = 'bi_refresh_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    const bootstrap = async () => {
      try {
        const existing = localStorage.getItem(REFRESH_KEY)
        if (!existing) {
          return
        }
        const refreshed = await refreshRequest(existing)
        localStorage.setItem(REFRESH_KEY, refreshed.refreshToken)
        setAccessToken(refreshed.accessToken)
        const profile = await me(refreshed.accessToken)
        if (active) {
          setUser(profile)
        }
      } catch {
        localStorage.removeItem(REFRESH_KEY)
        setUser(null)
        setAccessToken(null)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }
    bootstrap()
    return () => {
      active = false
    }
  }, [])

  async function login(identifier: string, password: string) {
    const session = await loginRequest(identifier, password)
    setAccessToken(session.accessToken)
    setUser(session.user)
    localStorage.setItem(REFRESH_KEY, session.refreshToken)
  }

  function logout() {
    setUser(null)
    setAccessToken(null)
    localStorage.removeItem(REFRESH_KEY)
  }

  function hasPermission(moduleKey: string, actionKey = 'view') {
    if (!user) {
      return false
    }
    if (user.userType === 'OWNER' || user.permissions.includes('*')) {
      return true
    }
    return user.permissions.includes(`${moduleKey}:${actionKey}`)
  }

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      login,
      logout,
      hasPermission,
    }),
    [user, accessToken, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
