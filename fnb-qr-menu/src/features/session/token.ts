import { openTableSession } from '@/api'

import { API_ERROR } from '@/constants/errors'
import { isApiError } from '@/lib/apiError'

import { getSession, updateSession } from './store'

export async function reopenSession(): Promise<string> {
  const { qr } = getSession()
  if (!qr) {
    throw { code: API_ERROR.UNAUTHORIZED, message: 'Sesi meja tidak valid' }
  }

  const opened = await openTableSession(qr)
  updateSession((prev) => ({ ...prev, qr, sessionToken: opened.sessionToken }))
  return opened.sessionToken
}

export async function withSessionRetry<T>(call: (sessionToken: string) => Promise<T>): Promise<T> {
  const { sessionToken } = getSession()
  if (!sessionToken) {
    throw { code: API_ERROR.UNAUTHORIZED, message: 'Sesi meja tidak valid' }
  }

  try {
    return await call(sessionToken)
  } catch (error) {
    if (!isApiError(error) || error.code !== API_ERROR.UNAUTHORIZED) throw error
    return call(await reopenSession())
  }
}
