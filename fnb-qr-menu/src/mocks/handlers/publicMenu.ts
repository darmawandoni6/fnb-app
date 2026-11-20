import { CLOSED_MENU, OPEN_MENU } from '@/mocks/data/menus'

import { API_ERROR } from '@/constants/errors'
import { MOCK_TABLE_TOKEN } from '@/constants/mockTokens'
import { mockError } from '@/lib/apiError'
import type { PublicMenu } from '@/types/menu'

import { sleep } from './index'

export async function getPublicMenu(qrToken: string): Promise<PublicMenu> {
  await sleep()

  if (qrToken === MOCK_TABLE_TOKEN.CLOSED) return structuredClone(CLOSED_MENU)
  if (qrToken === MOCK_TABLE_TOKEN.OPEN || qrToken === MOCK_TABLE_TOKEN.OUT_OF_STOCK) {
    return structuredClone(OPEN_MENU)
  }

  throw mockError(API_ERROR.NOT_FOUND, 404, 'QR meja tidak ditemukan')
}
