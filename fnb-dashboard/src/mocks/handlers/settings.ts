import { API_ERROR_CODE, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Settings } from '@/types'

import { audit, delay, fail, requireRole } from './shared'

export const getSettings = async (): Promise<Settings> => {
  await delay()
  return { ...db.settings }
}

const requireRate = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0)
    fail(API_ERROR_CODE.VALIDATION_ERROR, `${label} tidak valid`)
}

const requireMinutes = (value: number, label: string) => {
  if (!Number.isInteger(value) || value < 1)
    fail(API_ERROR_CODE.VALIDATION_ERROR, `${label} minimal 1 menit`)
}

export const updateSettings = async (body: Partial<Settings>): Promise<Settings> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (body.cafe_name !== undefined) {
    if (!body.cafe_name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama kafe wajib diisi')
    db.settings.cafe_name = body.cafe_name
  }
  // BR-12: a rate change applies to new orders only; existing orders keep their snapshot.
  if (body.service_rate !== undefined) {
    requireRate(body.service_rate, 'Service charge')
    db.settings.service_rate = body.service_rate
  }
  if (body.tax_rate !== undefined) {
    requireRate(body.tax_rate, 'Pajak')
    db.settings.tax_rate = body.tax_rate
  }
  if (body.cash_timeout_minutes !== undefined) {
    requireMinutes(body.cash_timeout_minutes, 'Timeout tunai')
    db.settings.cash_timeout_minutes = body.cash_timeout_minutes
  }
  if (body.delivered_auto_complete_minutes !== undefined) {
    requireMinutes(body.delivered_auto_complete_minutes, 'Auto-complete')
    db.settings.delivered_auto_complete_minutes = body.delivered_auto_complete_minutes
  }
  if (body.ready_auto_deliver_minutes !== undefined) {
    requireMinutes(body.ready_auto_deliver_minutes, 'Auto-deliver')
    db.settings.ready_auto_deliver_minutes = body.ready_auto_deliver_minutes
  }
  if (body.ready_auto_deliver_warning_minutes !== undefined) {
    requireMinutes(body.ready_auto_deliver_warning_minutes, 'Peringatan auto-deliver')
    db.settings.ready_auto_deliver_warning_minutes = body.ready_auto_deliver_warning_minutes
  }
  if (body.is_open !== undefined) {
    db.settings.is_open = body.is_open
    audit({
      entity: 'settings',
      entity_id: 'settings',
      action: body.is_open ? 'store_opened' : 'store_closed',
      from_value: null,
      to_value: String(body.is_open),
    })
  }
  return { ...db.settings }
}
