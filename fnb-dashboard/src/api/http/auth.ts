import { API_ERROR_CODE } from '@/constants'
import type { User } from '@/types'

import { clearProfile, readProfile, saveProfile } from '@/auth/profile'

import { ApiRequestError, request } from '../client'

type AuthResult = { user: User; access_token: string }

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const result = await request<AuthResult>({
    method: 'POST',
    url: '/auth/login',
    data: { email, password },
  })
  saveProfile(result.user)
  return result
}

/**
 * Refresh returns only `access_token` and the API has no `/auth/me`, so the cached
 * profile supplies the user. Without it the session cannot be restored.
 */
export const refresh = async (): Promise<AuthResult> => {
  const { access_token } = await request<{ access_token: string }>({
    method: 'POST',
    url: '/auth/refresh',
  })
  const user = readProfile()
  if (!user) {
    throw new ApiRequestError(API_ERROR_CODE.UNAUTHORIZED, 'Sesi berakhir, silakan masuk kembali')
  }
  return { user, access_token }
}

export const logout = async (): Promise<void> => {
  await request<void>({ method: 'POST', url: '/auth/logout' })
  clearProfile()
}
