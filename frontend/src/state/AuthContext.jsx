import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api/client.js'

const AuthContext = createContext(null)
const sessionWarningThresholdMs = 5 * 60 * 1000

function getTokenExpiryMs(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessExpiresAt, setAccessExpiresAt] = useState(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const [extendingSession, setExtendingSession] = useState(false)

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setAccessExpiresAt(null)
    setShowSessionWarning(false)
    setUser(null)
  }, [])

  const storeTokens = useCallback((tokens) => {
    localStorage.setItem('access_token', tokens.access)
    if (tokens.refresh) {
      localStorage.setItem('refresh_token', tokens.refresh)
    }
    setAccessExpiresAt(getTokenExpiryMs(tokens.access))
    setShowSessionWarning(false)
  }, [])

  const syncUserFromToken = useCallback(async ({ showLoading = false } = {}) => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      clearStoredSession()
      setLoading(false)
      return null
    }
    setAccessExpiresAt(getTokenExpiryMs(token))
    if (showLoading) setLoading(true)

    try {
      const currentUser = await apiRequest('/auth/me/')
      setUser(currentUser)
      return currentUser
    } catch {
      clearStoredSession()
      return null
    } finally {
      setLoading(false)
    }
  }, [clearStoredSession])

  const logout = clearStoredSession

  useEffect(() => {
    syncUserFromToken({ showLoading: true })
  }, [syncUserFromToken])

  useEffect(() => {
    function syncVisibleSession() {
      if (document.visibilityState === 'visible') {
        syncUserFromToken()
      }
    }

    function syncStoredSession(event) {
      if (event.key === 'access_token' || event.key === 'refresh_token') {
        syncUserFromToken()
      }
    }

    window.addEventListener('pageshow', syncUserFromToken)
    window.addEventListener('focus', syncUserFromToken)
    window.addEventListener('storage', syncStoredSession)
    document.addEventListener('visibilitychange', syncVisibleSession)

    return () => {
      window.removeEventListener('pageshow', syncUserFromToken)
      window.removeEventListener('focus', syncUserFromToken)
      window.removeEventListener('storage', syncStoredSession)
      document.removeEventListener('visibilitychange', syncVisibleSession)
    }
  }, [syncUserFromToken])

  useEffect(() => {
    if (!user || !accessExpiresAt) return undefined

    function checkSession() {
      const remainingMs = accessExpiresAt - Date.now()
      if (remainingMs <= 0) {
        logout()
        return
      }
      setShowSessionWarning(remainingMs <= sessionWarningThresholdMs)
    }

    checkSession()
    const timer = window.setInterval(checkSession, 10000)
    return () => window.clearInterval(timer)
  }, [user, accessExpiresAt, logout])

  const login = useCallback(async (username, password) => {
    const tokens = await apiRequest('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    storeTokens(tokens)
    const currentUser = await apiRequest('/auth/me/')
    setUser(currentUser)
  }, [storeTokens])

  const refreshUser = useCallback(async () => {
    return syncUserFromToken()
  }, [syncUserFromToken])

  const extendSession = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')
    if (!refresh) {
      logout()
      return
    }
    setExtendingSession(true)
    try {
      const tokens = await apiRequest('/auth/token/refresh/', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ refresh }),
      })
      storeTokens({ ...tokens, refresh: tokens.refresh || refresh })
    } catch {
      logout()
    } finally {
      setExtendingSession(false)
    }
  }, [logout, storeTokens])

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, showSessionWarning, extendSession, extendingSession }),
    [user, loading, login, logout, refreshUser, showSessionWarning, extendSession, extendingSession],
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
