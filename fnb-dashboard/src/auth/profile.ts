import type { User } from '@/types'

const PROFILE_KEY = 'fnb.profile'

/**
 * Refresh returns only `access_token` and the API has no `/auth/me`, so the profile comes
 * from the login response and is cached here to survive a reload. Never used for the token.
 */
export const saveProfile = (user: User) => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(user))
}

export const readProfile = (): User | null => {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export const clearProfile = () => {
  localStorage.removeItem(PROFILE_KEY)
}
