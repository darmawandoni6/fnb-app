import { expect, test } from 'vitest'

import { API_ERROR } from '@/constants/errors'
import { ITEM_STATUS } from '@/constants/itemStatus'
import { MOCK_TABLE_TOKEN } from '@/constants/mockTokens'
import { ORDER_STATUS } from '@/constants/orderStatus'

import { cancelOrderItem, createPublicOrder, getPublicOrder } from './publicOrders'

test('create, lookup, and cancel round-trip through the store', async () => {
  const created = await createPublicOrder(MOCK_TABLE_TOKEN.OPEN, {
    items: [
      { menuId: 'menu-latte', qty: 2, note: 'less sugar' },
      { menuId: 'menu-croissant', qty: 1, note: null },
    ],
  })

  expect(created.orderId).toMatch(/^order-mock-/)
  expect(created.trackingToken).toMatch(/^tracking-mock-/)
  expect(created.subtotalAmount).toBe(81000)
  expect(created.taxAmount).toBe(8100)
  expect(created.totalAmount).toBe(89100)
  expect(created.status).toBe(ORDER_STATUS.MENUNGGU)
  expect(created.items).toHaveLength(2)

  const found = await getPublicOrder(created.trackingToken)
  expect(found.orderId).toBe(created.orderId)

  const cancelled = await cancelOrderItem(created.trackingToken, created.items[0].id)
  expect(cancelled.items[0].status).toBe(ITEM_STATUS.CANCELLED)
  // Unpaid orders keep their totals after a cancellation.
  expect(cancelled.totalAmount).toBe(89100)

  const polled = await getPublicOrder(created.trackingToken)
  expect(polled.items[0].status).toBe(ITEM_STATUS.CANCELLED)
})

test('cancelling a non-pending item returns INVALID_TRANSITION', async () => {
  await expect(cancelOrderItem('demo-diproses', 'item-diproses-1')).rejects.toMatchObject({
    code: API_ERROR.INVALID_TRANSITION,
  })
})

test('cancelling on a paid order recalculates the totals', async () => {
  const cancelled = await cancelOrderItem('demo-lunas', 'item-lunas-1')
  expect(cancelled.status).toBe(ORDER_STATUS.DIBATALKAN)
  expect(cancelled.totalAmount).toBe(0)
})

test('order creation rejects closed, out-of-stock, and unknown tables', async () => {
  const request = { items: [{ menuId: 'menu-latte', qty: 1 }] }

  await expect(createPublicOrder(MOCK_TABLE_TOKEN.CLOSED, request)).rejects.toMatchObject({
    code: API_ERROR.STORE_CLOSED,
  })
  await expect(createPublicOrder(MOCK_TABLE_TOKEN.OUT_OF_STOCK, request)).rejects.toMatchObject({
    code: API_ERROR.STOCK_NOT_ENOUGH,
  })
  await expect(createPublicOrder(MOCK_TABLE_TOKEN.INVALID, request)).rejects.toMatchObject({
    code: API_ERROR.NOT_FOUND,
  })
})

test('unknown menu ids fail validation', async () => {
  await expect(
    createPublicOrder(MOCK_TABLE_TOKEN.OPEN, { items: [{ menuId: 'menu-hilang', qty: 1 }] }),
  ).rejects.toMatchObject({ code: API_ERROR.VALIDATION_ERROR })
})
