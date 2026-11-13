import { API_ERROR_CODE, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Settings } from '@/types'

import { delay, fail, requireRole } from './shared'

export const getSettings = async (): Promise<Settings> => {
  await delay()
  return { ...db.settings }
}

export const updateSettings = async (body: {
  cafe_name?: string
  tax_percent?: number
  is_open?: boolean
}): Promise<Settings> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (body.cafe_name !== undefined) {
    if (!body.cafe_name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama kafe wajib diisi')
    db.settings.cafe_name = body.cafe_name
  }
  if (body.tax_percent !== undefined) {
    if (!Number.isInteger(body.tax_percent) || body.tax_percent < 0 || body.tax_percent > 100) {
      fail(API_ERROR_CODE.VALIDATION_ERROR, 'Pajak harus 0–100')
    }
    db.settings.tax_percent = body.tax_percent
  }
  if (body.is_open !== undefined) db.settings.is_open = body.is_open
  return { ...db.settings }
}
