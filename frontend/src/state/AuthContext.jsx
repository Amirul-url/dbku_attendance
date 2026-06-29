import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoading(false)
      return
    }
    setAccessExpiresAt(getTokenExpiryMs(token))

    apiRequest('/auth/me/')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

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
  }, [user, accessExpiresAt])

  function storeTokens(tokens) {
    localStorage.setItem('access_token', tokens.access)
    if (tokens.refresh) {
      localStorage.setItem('refresh_token', tokens.refresh)
    }
    setAccessExpiresAt(getTokenExpiryMs(tokens.access))
    setShowSessionWarning(false)
  }

  async function login(username, password) {
    const tokens = await apiRequest('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    storeTokens(tokens)
    const currentUser = await apiRequest('/auth/me/')
    setUser(currentUser)
  }

  async function refreshUser() {
    const currentUser = await apiRequest('/auth/me/')
    setUser(currentUser)
    return currentUser
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setAccessExpiresAt(null)
    setShowSessionWarning(false)
    setUser(null)
  }

  async function extendSession() {
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
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, showSessionWarning, extendSession, extendingSession }),
    [user, loading, showSessionWarning, extendingSession],
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
