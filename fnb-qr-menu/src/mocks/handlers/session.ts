import { MOCK_SESSION_STORE } from '@/mocks/data/sessions'
import type { MockScenario, MockSession } from '@/mocks/data/sessions'

import { API_ERROR } from '@/constants/errors'
import { MOCK_TABLE_TOKEN } from '@/constants/mockTokens'
import { mockError } from '@/lib/apiError'
import type { OpenSessionResponse } from '@/types/order'

import { sleep } from './index'

const SCENARIO_BY_QR: Record<string, MockScenario> = {
  [MOCK_TABLE_TOKEN.OPEN]: 'open',
  [MOCK_TABLE_TOKEN.CLOSED]: 'closed',
  [MOCK_TABLE_TOKEN.OUT_OF_STOCK]: 'outOfStock',
}

export async function openTableSession(qrToken: string): Promise<OpenSessionResponse> {
  await sleep()

  const scenario = SCENARIO_BY_QR[qrToken]
  if (!scenario) {
    throw mockError(API_ERROR.NOT_FOUND, 404, 'QR meja tidak ditemukan')
  }

  const existing = MOCK_SESSION_STORE.tokenByQr.get(qrToken)
  const session: MockSession | undefined = existing
    ? MOCK_SESSION_STORE.byToken.get(existing)
    : undefined
  if (session) {
    return { sessionToken: session.sessionToken, tableNumber: session.tableNumber, status: 'OPEN' }
  }

  const sessionToken = `mock-session-${MOCK_SESSION_STORE.nextSeq}`
  const tableNumber = qrToken === MOCK_TABLE_TOKEN.OPEN ? 'A1' : `M${MOCK_SESSION_STORE.nextSeq}`
  MOCK_SESSION_STORE.nextSeq += 1
  MOCK_SESSION_STORE.byToken.set(sessionToken, { sessionToken, tableNumber, scenario })
  MOCK_SESSION_STORE.tokenByQr.set(qrToken, sessionToken)

  return { sessionToken, tableNumber, status: 'OPEN' }
}
