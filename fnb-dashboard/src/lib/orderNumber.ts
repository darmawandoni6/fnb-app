import type { OrderType } from '@/constants'

/**
 * `../docs/api.md`: `DI-YYYYMMDD-SSS` for dine-in, `TA-YYYYMMDD-SSS` for take away.
 * `SSS` is the daily sequence per order type.
 */
export const orderNumberPrefix = (orderType: OrderType) => (orderType === 'TAKE_AWAY' ? 'TA' : 'DI')

/** Local business day as `YYYYMMDD`. */
export const businessDay = (at: string | Date = new Date()) =>
  (typeof at === 'string' ? at : at.toISOString()).slice(0, 10).replaceAll('-', '')

export const formatOrderNumber = (orderType: OrderType, createdAt: string | Date, seq: number) =>
  `${orderNumberPrefix(orderType)}-${businessDay(createdAt)}-${String(seq).padStart(3, '0')}`

/** Reads the daily sequence back out of an existing order number; other shapes count as zero. */
export const orderNumberSequence = (orderNumber: string, orderType: OrderType, day: string) => {
  const match = orderNumber.match(new RegExp(`^${orderNumberPrefix(orderType)}-${day}-(\\d+)$`))
  return match ? Number(match[1]) : 0
}
