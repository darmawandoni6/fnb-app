import { ITEM_STATUS, ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'

export const SERVICE_RATE = 5
export const TAX_RATE = 10

/** PRD §6: service from the subtotal, tax from subtotal + service, round half up per component. */
export const calcTotals = (subtotal: number, serviceRate: number, taxRate: number) => {
  const service_amount = Math.round((subtotal * serviceRate) / 100)
  const tax_amount = Math.round(((subtotal + service_amount) * taxRate) / 100)
  return {
    service_amount,
    tax_amount,
    total_amount: subtotal + service_amount + tax_amount,
  }
}

const item = (
  id: string,
  menuId: string,
  menuName: string,
  status: OrderItem['status'],
  qty = 1,
): OrderItem => ({
  id,
  menu_id: menuId,
  menu_name_snapshot: menuName,
  qty,
  price: menuId === 'menu-1' ? 18000 : 15000,
  note: null,
  status,
  ready_at: status === 'READY' ? '2026-01-01T10:10:00.000Z' : null,
  delivered_at: null,
  completed_at: null,
  cancelled_at: null,
})

const order = (
  id: string,
  orderNumber: string,
  type: Order['order_type'],
  payment: Order['payment_status'],
  status: Order['status'],
  items: OrderItem[],
): Order => {
  const subtotal = items.reduce((sum, current) => sum + current.qty * current.price, 0)
  const totals = calcTotals(subtotal, SERVICE_RATE, TAX_RATE)
  const isPaid = payment === PAYMENT_STATUS.LUNAS
  return {
    id,
    order_number: orderNumber,
    order_type: type,
    table_id: type === ORDER_TYPE.DINE_IN ? 'table-1' : null,
    table_number: type === ORDER_TYPE.DINE_IN ? '1' : null,
    table_session_id: type === ORDER_TYPE.DINE_IN ? 'session-1' : null,
    created_by: type === ORDER_TYPE.TAKE_AWAY ? 'user-2' : null,
    created_by_name: type === ORDER_TYPE.TAKE_AWAY ? 'Kasir' : null,
    customer_name: 'Budi',
    customer_phone: null,
    status,
    payment_status: payment,
    payment_method: isPaid ? PAYMENT_METHOD.CASH : null,
    payment_ref: null,
    paid_at: isPaid ? '2026-01-01T10:05:00.000Z' : null,
    amount_received: isPaid ? totals.total_amount : null,
    change_amount: isPaid ? 0 : null,
    cancel_reason: status === ORDER_STATUS.DIBATALKAN ? 'Batal manual' : null,
    canceled_at: status === ORDER_STATUS.DIBATALKAN ? '2026-01-01T10:20:00.000Z' : null,
    subtotal_amount: subtotal,
    service_rate_snapshot: SERVICE_RATE,
    tax_rate_snapshot: TAX_RATE,
    ...totals,
    created_at: '2026-01-01T10:00:00.000Z',
    items,
  }
}

export const orders: Order[] = [
  order(
    'order-1',
    'DI-20260101-001',
    ORDER_TYPE.DINE_IN,
    PAYMENT_STATUS.BELUM,
    ORDER_STATUS.MENUNGGU,
    [
      item('item-1', 'menu-1', 'Kopi Susu', ITEM_STATUS.PENDING),
      item('item-2', 'menu-2', 'Americano', ITEM_STATUS.PENDING),
    ],
  ),
  order(
    'order-2',
    'TA-20260101-001',
    ORDER_TYPE.TAKE_AWAY,
    PAYMENT_STATUS.LUNAS,
    ORDER_STATUS.DIPROSES,
    [
      item('item-3', 'menu-1', 'Kopi Susu', ITEM_STATUS.PENDING),
      item('item-4', 'menu-2', 'Americano', ITEM_STATUS.COOKING),
    ],
  ),
  order(
    'order-3',
    'DI-20260101-002',
    ORDER_TYPE.DINE_IN,
    PAYMENT_STATUS.LUNAS,
    ORDER_STATUS.DIPROSES,
    [
      item('item-5', 'menu-1', 'Kopi Susu', ITEM_STATUS.COOKING),
      item('item-6', 'menu-2', 'Americano', ITEM_STATUS.READY),
    ],
  ),
  order(
    'order-4',
    'DI-20260101-003',
    ORDER_TYPE.DINE_IN,
    PAYMENT_STATUS.LUNAS,
    ORDER_STATUS.DIPROSES,
    [item('item-7', 'menu-1', 'Kopi Susu', ITEM_STATUS.READY)],
  ),
  order(
    'order-5',
    'TA-20260101-002',
    ORDER_TYPE.TAKE_AWAY,
    PAYMENT_STATUS.LUNAS,
    ORDER_STATUS.DIPROSES,
    [
      item('item-8', 'menu-1', 'Kopi Susu', ITEM_STATUS.DELIVERED),
      item('item-9', 'menu-2', 'Americano', ITEM_STATUS.READY),
    ],
  ),
  order(
    'order-6',
    'TA-20260101-003',
    ORDER_TYPE.TAKE_AWAY,
    PAYMENT_STATUS.LUNAS,
    ORDER_STATUS.SELESAI,
    [item('item-10', 'menu-1', 'Kopi Susu', ITEM_STATUS.COMPLETED)],
  ),
  order(
    'order-7',
    'DI-20260101-004',
    ORDER_TYPE.DINE_IN,
    PAYMENT_STATUS.BELUM,
    ORDER_STATUS.DIBATALKAN,
    [item('item-11', 'menu-1', 'Kopi Susu', ITEM_STATUS.CANCELLED)],
  ),
  order(
    'order-8',
    'TA-20260101-004',
    ORDER_TYPE.TAKE_AWAY,
    PAYMENT_STATUS.BELUM,
    ORDER_STATUS.MENUNGGU,
    [item('item-12', 'menu-1', 'Kopi Susu', ITEM_STATUS.PENDING)],
  ),
]
