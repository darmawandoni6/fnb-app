import { API_ERROR_CODE, ITEM_STATUS, ORDER_STATUS, PAYMENT_STATUS, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Settings } from '@/types'

import { businessDay } from '@/lib/orderNumber'

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
  if (body.is_open === false) fail(API_ERROR_CODE.INVALID_TRANSITION, 'Gunakan tombol tutup toko')
  // `../docs/api.md`: validate the timer pair as a whole, so a partial patch cannot break it.
  const nextDeliver = body.ready_auto_deliver_minutes ?? db.settings.ready_auto_deliver_minutes
  const nextWarning =
    body.ready_auto_deliver_warning_minutes ?? db.settings.ready_auto_deliver_warning_minutes
  if (body.ready_auto_deliver_minutes !== undefined) requireMinutes(nextDeliver, 'Auto-deliver')
  if (body.ready_auto_deliver_warning_minutes !== undefined)
    requireMinutes(nextWarning, 'Peringatan auto-deliver')
  if (nextWarning >= nextDeliver)
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Peringatan auto-deliver harus lebih kecil')
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
  if (body.ready_auto_deliver_minutes !== undefined)
    db.settings.ready_auto_deliver_minutes = nextDeliver
  if (body.ready_auto_deliver_warning_minutes !== undefined)
    db.settings.ready_auto_deliver_warning_minutes = nextWarning
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

export const closeStore = async (): Promise<Settings> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const day = businessDay()
  const todays = db.orders.filter((order) => businessDay(order.created_at) === day)

  const processing = todays.filter((order) => order.status === ORDER_STATUS.DIPROSES)
  if (processing.length > 0)
    fail(API_ERROR_CODE.INVALID_TRANSITION, `${processing.length} pesanan masih diproses hari ini`)

  const pending = todays.filter(
    (order) =>
      order.status === ORDER_STATUS.MENUNGGU && order.payment_status === PAYMENT_STATUS.BELUM,
  )
  const now = new Date().toISOString()
  pending.forEach((order) => {
    order.items
      .filter((item) => item.status !== ITEM_STATUS.CANCELLED)
      .forEach((item) => {
        db.recipeItems
          .filter((recipe) => recipe.menu_id === item.menu_id)
          .forEach((recipe, index) => {
            const ingredient = db.ingredients.find(({ id }) => id === recipe.ingredient_id)
            if (!ingredient) return
            const qty = recipe.qty_used * item.qty
            ingredient.stock_qty += qty
            db.stockMovements.unshift({
              id: `movement-restore-${Date.now()}-${item.id}-${index}`,
              ingredient_id: ingredient.id,
              type: 'RESTORE',
              qty,
              created_at: now,
              note: `Tutup toko: batal pesanan #${order.order_number}`,
              order_id: order.id,
              order_item_id: item.id,
            })
          })
        item.status = ITEM_STATUS.CANCELLED
        item.cancelled_at = now
      })
    order.status = ORDER_STATUS.DIBATALKAN
    order.cancel_reason = 'store closed'
    order.canceled_at = now
    audit({
      entity: 'order',
      entity_id: order.id,
      action: 'order_cancelled',
      from_value: ORDER_STATUS.MENUNGGU,
      to_value: ORDER_STATUS.DIBATALKAN,
    })
  })

  db.settings.is_open = false
  audit({
    entity: 'settings',
    entity_id: 'settings',
    action: 'store_closed',
    from_value: null,
    to_value: 'false',
  })
  return { ...db.settings }
}
