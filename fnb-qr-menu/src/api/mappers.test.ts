import { expect, test } from 'vitest'

import { ITEM_STATUS } from '@/constants/itemStatus'
import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_METHOD } from '@/constants/paymentMethod'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'

import { toCreateOrderRequest, toPublicMenu, toPublicOrder } from './mappers'
import { sessionSocketUrl } from './socket'

test('maps the snake_case menu envelope and keeps integer rupiah', () => {
  const menu = toPublicMenu({
    cafe_name: 'Kopi Senja',
    service_rate: 5,
    tax_rate: 10,
    is_open: true,
    categories: [
      {
        id: 'c1',
        name: 'Coffee',
        menus: [{ id: 'm1', name: 'Latte', price: 25000, image_url: null }],
      },
    ],
  })

  expect(menu.cafeName).toBe('Kopi Senja')
  expect(menu.categories[0].menus[0]).toEqual({
    id: 'm1',
    name: 'Latte',
    price: 25000,
    imageUrl: null,
  })
})

test('maps a listed order and defaults the ephemeral payment url to null', () => {
  const order = toPublicOrder({
    id: 'o1',
    order_number: 'DI-20261121-001',
    status: ORDER_STATUS.DIPROSES,
    payment_status: PAYMENT_STATUS.BELUM,
    subtotal_amount: 25000,
    service_amount: 1250,
    tax_amount: 2625,
    total_amount: 28875,
    items: [
      {
        id: 'i1',
        menu_id: 'm1',
        menu_name: 'Latte',
        qty: 1,
        price: 25000,
        status: ITEM_STATUS.COOKING,
        note: null,
      },
    ],
  })

  expect(order.paymentUrl).toBeNull()
  expect(order.orderNumber).toBe('DI-20261121-001')
  expect(order.items[0].menuNameSnapshot).toBe('Latte')
})

test('sends only menu id, qty, and note for each line', () => {
  const body = toCreateOrderRequest({
    orderType: 'DINE_IN',
    customerName: 'Budi',
    customerPhone: null,
    paymentMethod: PAYMENT_METHOD.CASH,
    items: [{ menuId: 'm1', qty: 2, note: 'no sugar' }],
  })

  expect(body).toEqual({
    order_type: 'DINE_IN',
    customer_name: 'Budi',
    customer_phone: null,
    payment_method: 'CASH',
    items: [{ menu_id: 'm1', qty: 2, note: 'no sugar' }],
  })
})

test('builds the session socket URL from the API base', () => {
  expect(sessionSocketUrl('tok')).toMatch(/^ws:\/\/.+\/ws\?session=tok$/)
})
