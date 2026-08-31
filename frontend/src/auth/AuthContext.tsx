import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { changePassword as changePasswordRequest, login as loginRequest, me } from './api'
import type { AuthUser } from './types'
import {
  expireSession,
  getAccessToken,
  getRefreshToken,
  isIdleExpired,
  refreshSession,
  setSessionTokens,
  shouldRefreshAccessToken,
  subscribeSession,
  touchActivity,
} from './session'

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<AuthUser>
  logout: () => void
  refreshUser: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  hasPermission: (moduleKey: string, actionKey?: string) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const
const ACTIVITY_THROTTLE_MS = 15_000
const SESSION_CHECK_MS = 30_000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    return subscribeSession((tokens) => {
      setAccessToken(tokens?.accessToken ?? null)
      if (!tokens) {
        setUser(null)
      }
    })
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getAccessToken()
    if (!token) return
    const profile = await me(token)
    setUser(profile)
  }, [])

  useEffect(() => {
    let active = true
    const bootstrap = async () => {
      try {
        if (isIdleExpired()) {
          expireSession()
          return
        }
        const existingToken = getAccessToken()
        if (existingToken && !shouldRefreshAccessToken(existingToken)) {
          const profile = await me(existingToken)
          if (active) {
            setUser(profile)
            setAccessToken(existingToken)
            touchActivity()
          }
          return
        }
        const existing = getRefreshToken()
        if (!existing) {
          return
        }
        const refreshed = await refreshSession()
        if (!refreshed) {
          return
        }
        const profile = await me(refreshed.accessToken)
        if (active) {
          setUser(profile)
          touchActivity()
        }
      } catch {
        expireSession()
        setUser(null)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let lastTouch = 0

    const onActivity = () => {
      if (!getRefreshToken() && !getAccessToken()) return
      const now = Date.now()
      if (now - lastTouch < ACTIVITY_THROTTLE_MS) return
      lastTouch = now
      touchActivity()
      if (shouldRefreshAccessToken()) {
        void refreshSession()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (!getRefreshToken() && !getAccessToken()) return
      if (isIdleExpired()) {
        expireSession()
        return
      }
      onActivity()
    }

    const onInterval = () => {
      if (!getRefreshToken() && !getAccessToken()) return
      if (isIdleExpired()) {
        expireSession()
        return
      }
      if (shouldRefreshAccessToken()) {
        void refreshSession()
      }
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    const intervalId = window.setInterval(onInterval, SESSION_CHECK_MS)

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(intervalId)
    }
  }, [])

  async function login(identifier: string, password: string) {
    const session = await loginRequest(identifier, password)
    setSessionTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    })
    touchActivity()
    setUser(session.user)
    return session.user
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    const tokens = await changePasswordRequest(token, currentPassword, newPassword)
    setSessionTokens(tokens)
    touchActivity()
    const profile = await me(tokens.accessToken)
    setUser(profile)
  }

  function logout() {
    setUser(null)
    expireSession()
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
      refreshUser,
      changePassword,
      hasPermission,
    }),
    [user, accessToken, isLoading, refreshUser],
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
