import { expect, test } from 'vitest'

import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import type { PublicOrder } from '@/types/order'

import type { TrackedOrder } from '@/features/session/store'

import { isFinished, unfinishedOrderCount } from './status'

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
