import { API_ERROR_CODE } from '@/constants'
import { db } from '@/mocks/db'
import type { User } from '@/types'

import { delay, fail } from './shared'

export const login = async (
  email: string,
  password: string,
): Promise<{ user: User; access_token: string }> => {
  await delay()
  const user = db.users.find((candidate) => candidate.email === email && candidate.is_active)
  if (!user || password !== 'demo') fail(API_ERROR_CODE.UNAUTHORIZED, 'Invalid credentials')
  const authenticatedUser: User = user!
  db.currentUserId = authenticatedUser.id
  return { user: authenticatedUser, access_token: `mock-token-${authenticatedUser.id}` }
}

export const refresh = async (): Promise<{ user: User; access_token: string }> => {
  await delay()
  const user = db.users.find(({ id }) => id === db.currentUserId)
  if (!user) fail(API_ERROR_CODE.UNAUTHORIZED, 'Mock session is not authenticated')
  const authenticatedUser: User = user!
  return { user: authenticatedUser, access_token: `mock-token-${authenticatedUser.id}` }
}

export const logout = async (): Promise<void> => {
  await delay()
  db.currentUserId = ''
}
