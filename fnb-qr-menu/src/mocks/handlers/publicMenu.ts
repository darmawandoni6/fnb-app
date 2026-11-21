import { CLOSED_MENU, OPEN_MENU } from '@/mocks/data/menus'
import { findMockSession } from '@/mocks/data/sessions'

import { API_ERROR } from '@/constants/errors'
import { mockError } from '@/lib/apiError'
import type { PublicMenu } from '@/types/menu'

import { sleep } from './index'

export async function getPublicMenu(sessionToken: string): Promise<PublicMenu> {
  await sleep()

  const session = findMockSession(sessionToken)
  if (!session) {
    throw mockError(API_ERROR.UNAUTHORIZED, 401, 'Sesi meja tidak valid')
  }

  return structuredClone(session.scenario === 'closed' ? CLOSED_MENU : OPEN_MENU)
}
