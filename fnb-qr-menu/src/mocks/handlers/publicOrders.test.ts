import { expect, test } from 'vitest'

import { API_ERROR } from '@/constants/errors'
import { ITEM_STATUS } from '@/constants/itemStatus'
import { MOCK_TABLE_TOKEN } from '@/constants/mockTokens'
import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_METHOD } from '@/constants/paymentMethod'

import { cancelPublicOrder, createPublicOrder, getPublicOrders } from './publicOrders'
import { openTableSession } from './session'

const request = {
  orderType: 'DINE_IN' as const,
  customerName: 'Budi',
  customerPhone: null,
  paymentMethod: PAYMENT_METHOD.CASH,
  items: [
    { menuId: 'menu-latte', qty: 2, note: 'less sugar' },
    { menuId: 'menu-croissant', qty: 1, note: null },
  ],
}

test('create, list, and cancel round-trip through the session', async () => {
  const { sessionToken } = await openTableSession(MOCK_TABLE_TOKEN.OPEN)

  const created = await createPublicOrder(sessionToken, request)

  expect(created.id).toMatch(/^order-mock-/)
  expect(created.status).toBe(ORDER_STATUS.MENUNGGU)
  expect(created.subtotalAmount).toBe(81000)
  expect(created.items).toHaveLength(2)

  const listed = await getPublicOrders(sessionToken)
  expect(listed).toHaveLength(1)
  expect(listed[0].id).toBe(created.id)

  const cancelled = await cancelPublicOrder(sessionToken, created.id, { reason: 'salah pesan' })
  expect(cancelled.status).toBe(ORDER_STATUS.DIBATALKAN)
  expect(cancelled.items.every((item) => item.status === ITEM_STATUS.CANCELLED)).toBe(true)
})

test('non-cash orders carry a payment URL', async () => {
  const { sessionToken } = await openTableSession(MOCK_TABLE_TOKEN.OPEN)

  const created = await createPublicOrder(sessionToken, {
    ...request,
    paymentMethod: PAYMENT_METHOD.NON_CASH,
  })

  expect(created.paymentUrl).toBeTruthy()
})

test('an empty customer name fails validation', async () => {
  const { sessionToken } = await openTableSession(MOCK_TABLE_TOKEN.OPEN)

  await expect(
    createPublicOrder(sessionToken, { ...request, customerName: '  ' }),
  ).rejects.toMatchObject({ code: API_ERROR.VALIDATION_ERROR })
})

test('unknown menu ids fail validation', async () => {
  const { sessionToken } = await openTableSession(MOCK_TABLE_TOKEN.OPEN)

  await expect(
    createPublicOrder(sessionToken, { ...request, items: [{ menuId: 'menu-hilang', qty: 1 }] }),
  ).rejects.toMatchObject({ code: API_ERROR.VALIDATION_ERROR })
})

test('cancelling a paid or non-waiting order returns INVALID_TRANSITION', async () => {
  const { sessionToken } = await openTableSession(MOCK_TABLE_TOKEN.OPEN)
  const created = await createPublicOrder(sessionToken, request)

  await cancelPublicOrder(sessionToken, created.id, { reason: '' })

  await expect(cancelPublicOrder(sessionToken, created.id, { reason: '' })).rejects.toMatchObject({
    code: API_ERROR.INVALID_TRANSITION,
  })
})

test('order creation rejects closed and out-of-stock tables', async () => {
  const closed = await openTableSession(MOCK_TABLE_TOKEN.CLOSED)
  await expect(createPublicOrder(closed.sessionToken, request)).rejects.toMatchObject({
    code: API_ERROR.STORE_CLOSED,
  })

  const outOfStock = await openTableSession(MOCK_TABLE_TOKEN.OUT_OF_STOCK)
  await expect(createPublicOrder(outOfStock.sessionToken, request)).rejects.toMatchObject({
    code: API_ERROR.STOCK_NOT_ENOUGH,
  })
})

test('an unknown session token is unauthorized', async () => {
  await expect(getPublicOrders('missing-token')).rejects.toMatchObject({
    code: API_ERROR.UNAUTHORIZED,
  })
  await expect(createPublicOrder('missing-token', request)).rejects.toMatchObject({
    code: API_ERROR.UNAUTHORIZED,
  })
})
