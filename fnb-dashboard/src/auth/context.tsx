import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

import { api, initWS } from '@/api'
import type { User } from '@/types'

import { emitUnauthorized, getAccessToken, setAccessToken } from '@/auth/token'

export { getAccessToken, setAccessToken, emitUnauthorized as onUnauthorized }

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.refresh().then(
      (result) => {
        if (!active) return
        setAccessToken(result.access_token)
        setUser(result.user)
        setIsLoading(false)
        initWS()
      },
      () => {
        if (!active) return
        setAccessToken(null)
        setUser(null)
        setIsLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [])

  // The HTTP client refreshes once on 401, then gives up and fires this event.
  useEffect(() => {
    const onUnauthorized = () => {
      setAccessToken(null)
      setUser(null)
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password)
    setAccessToken(result.access_token)
    setUser(result.user)
    initWS()
  }

  const logout = async () => {
    await api.logout().catch(() => undefined)
    setAccessToken(null)
    setUser(null)
    emitUnauthorized()
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
