import { expect, test } from 'vitest'

import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import type { PublicOrder } from '@/types/order'

import type { TrackedOrder } from '@/features/session/store'

import { isFinished, mergeOrders, ordersPollInterval, unfinishedOrderCount } from './status'

const order = (id: string, status: PublicOrder['status']): TrackedOrder => ({
  id,
  snapshot: {
    id,
    orderNumber: id,
    status,
    paymentStatus: PAYMENT_STATUS.BELUM,
    orderType: 'DINE_IN',
    customerName: 'Budi',
    subtotalAmount: 0,
    serviceAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    paymentUrl: null,
    items: [],
  },
})

test('an empty history has nothing to track', () => {
  expect(unfinishedOrderCount([])).toBe(0)
})

test('only terminal statuses count as finished', () => {
  expect(isFinished(ORDER_STATUS.SELESAI)).toBe(true)
  expect(isFinished(ORDER_STATUS.DIBATALKAN)).toBe(true)
  expect(isFinished(ORDER_STATUS.MENUNGGU)).toBe(false)
  expect(isFinished(ORDER_STATUS.DIPROSES)).toBe(false)
})

test('counts the orders still running', () => {
  expect(
    unfinishedOrderCount([
      order('a', ORDER_STATUS.MENUNGGU),
      order('b', ORDER_STATUS.SELESAI),
      order('c', ORDER_STATUS.DIPROSES),
      order('d', ORDER_STATUS.DIBATALKAN),
    ]),
  ).toBe(2)
})

test('a fully finished history is zero', () => {
  expect(
    unfinishedOrderCount([order('a', ORDER_STATUS.SELESAI), order('b', ORDER_STATUS.DIBATALKAN)]),
  ).toBe(0)
})

test('union merge appends discovered orders and keeps stored snapshots', () => {
  const stored = order('a', ORDER_STATUS.MENUNGGU)
  const merged = mergeOrders(
    [stored],
    [order('a', ORDER_STATUS.DIPROSES).snapshot, order('b', ORDER_STATUS.DIPROSES).snapshot],
  )

  expect(merged.map((entry) => entry.id)).toEqual(['a', 'b'])
  expect(merged[0].snapshot.status).toBe(ORDER_STATUS.DIPROSES)
  expect(merged[1].snapshot.status).toBe(ORDER_STATUS.DIPROSES)
})

test('a stored order missing from the list keeps its snapshot', () => {
  const stored = order('a', ORDER_STATUS.MENUNGGU)
  expect(mergeOrders([stored], [])).toEqual([stored])
})

test('polling stops when every order is terminal', () => {
  expect(ordersPollInterval([order('a', ORDER_STATUS.SELESAI).snapshot], null)).toBe(false)
})

test('a 429 doubles the poll interval', () => {
  const rateLimited = { code: 'INTERNAL_ERROR', message: 'too many', status: 429 }
  expect(ordersPollInterval([], rateLimited)).toBe(10_000)
  expect(ordersPollInterval([], null)).toBe(5_000)
})
