import { ITEM_STATUS, ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'

const item = (
  id: string,
  menuId: string,
  menuName: string,
  status: OrderItem['status'],
): OrderItem => ({
  id,
  menu_id: menuId,
  menu_name: menuName,
  qty: 1,
  unit_price: menuId === 'menu-1' ? 18000 : 15000,
  note: null,
  status,
})

const order = (
  id: string,
  type: Order['order_type'],
  payment: Order['payment_status'],
  status: Order['status'],
  items: OrderItem[],
): Order => ({
  id,
  order_type: type,
  table_id: type === ORDER_TYPE.QR ? 'table-1' : null,
  table_number: type === ORDER_TYPE.QR ? '1' : null,
  status,
  payment_status: payment,
  payment_method: payment === PAYMENT_STATUS.LUNAS ? PAYMENT_METHOD.CASH : null,
  subtotal_amount: items.reduce((sum, current) => sum + current.qty * current.unit_price, 0),
  tax_amount: 0,
  tax_percent: 10,
  total_amount: items.reduce((sum, current) => sum + current.qty * current.unit_price, 0),
  created_at: '2026-01-01T10:00:00.000Z',
  items,
})

export const orders: Order[] = [
  order('order-1', ORDER_TYPE.QR, PAYMENT_STATUS.BELUM, ORDER_STATUS.MENUNGGU, [
    item('item-1', 'menu-1', 'Kopi Susu', ITEM_STATUS.PENDING),
    item('item-2', 'menu-2', 'Americano', ITEM_STATUS.PENDING),
  ]),
  order('order-2', ORDER_TYPE.MANUAL, PAYMENT_STATUS.LUNAS, ORDER_STATUS.DIPROSES, [
    item('item-3', 'menu-1', 'Kopi Susu', ITEM_STATUS.PENDING),
    item('item-4', 'menu-2', 'Americano', ITEM_STATUS.COOKING),
  ]),
  order('order-3', ORDER_TYPE.QR, PAYMENT_STATUS.LUNAS, ORDER_STATUS.DIPROSES, [
    item('item-5', 'menu-1', 'Kopi Susu', ITEM_STATUS.COOKING),
    item('item-6', 'menu-2', 'Americano', ITEM_STATUS.READY),
  ]),
  order('order-4', ORDER_TYPE.QR, PAYMENT_STATUS.LUNAS, ORDER_STATUS.SIAP, [
    item('item-7', 'menu-1', 'Kopi Susu', ITEM_STATUS.READY),
  ]),
  order('order-5', ORDER_TYPE.MANUAL, PAYMENT_STATUS.LUNAS, ORDER_STATUS.DIANTAR, [
    item('item-8', 'menu-1', 'Kopi Susu', ITEM_STATUS.DELIVERED),
    item('item-9', 'menu-2', 'Americano', ITEM_STATUS.READY),
  ]),
  order('order-6', ORDER_TYPE.QR, PAYMENT_STATUS.LUNAS, ORDER_STATUS.SELESAI, [
    item('item-10', 'menu-1', 'Kopi Susu', ITEM_STATUS.DELIVERED),
  ]),
  order('order-7', ORDER_TYPE.QR, PAYMENT_STATUS.BELUM, ORDER_STATUS.DIBATALKAN, [
    item('item-11', 'menu-1', 'Kopi Susu', ITEM_STATUS.CANCELLED),
  ]),
  order('order-8', ORDER_TYPE.QR, PAYMENT_STATUS.BELUM, ORDER_STATUS.MENUNGGU, [
    item('item-12', 'menu-1', 'Kopi Susu', ITEM_STATUS.PENDING),
  ]),
]
