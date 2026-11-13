import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

import { api } from '@/api'
import type { User } from '@/types'

let accessToken: string | null = null

export const getAccessToken = () => accessToken
export const setAccessToken = (token: string | null) => {
  accessToken = token
}

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

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password)
    setAccessToken(result.access_token)
    setUser(result.user)
  }

  const logout = async () => {
    await api.logout().catch(() => undefined)
    setAccessToken(null)
    setUser(null)
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
