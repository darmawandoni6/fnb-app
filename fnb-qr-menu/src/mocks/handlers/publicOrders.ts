import { OPEN_MENU } from '@/mocks/data/menus'
import { ORDER_STORE } from '@/mocks/data/orders'
import { findMockSession } from '@/mocks/data/sessions'

import { API_ERROR } from '@/constants/errors'
import { ITEM_STATUS } from '@/constants/itemStatus'
import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_METHOD } from '@/constants/paymentMethod'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import { mockError } from '@/lib/apiError'
import type {
  CancelPublicOrderRequest,
  CreatePublicOrderRequest,
  OrderStatusResponse,
  PublicOrder,
  PublicOrderItem,
} from '@/types/order'

import { sleep } from './index'

const MENU_INDEX = new Map(
  OPEN_MENU.categories.flatMap((category) =>
    category.menus.map((menu) => [menu.id, menu] as const),
  ),
)

function cloneOrder(order: PublicOrder): PublicOrder {
  return structuredClone(order)
}

function requireSession(sessionToken: string) {
  const session = findMockSession(sessionToken)
  if (!session) {
    throw mockError(API_ERROR.UNAUTHORIZED, 401, 'Sesi meja tidak valid')
  }
  return session
}

function ordersOf(sessionToken: string): PublicOrder[] {
  const existing = ORDER_STORE.bySession.get(sessionToken)
  if (existing) return existing
  const created: PublicOrder[] = []
  ORDER_STORE.bySession.set(sessionToken, created)
  return created
}

export async function createPublicOrder(
  sessionToken: string,
  request: CreatePublicOrderRequest,
): Promise<OrderStatusResponse> {
  await sleep()

  const session = requireSession(sessionToken)

  if (session.scenario === 'closed') {
    throw mockError(API_ERROR.STORE_CLOSED, 409, 'Toko sedang tutup')
  }
  if (session.scenario === 'outOfStock') {
    throw mockError(API_ERROR.STOCK_NOT_ENOUGH, 409, 'Stok menu tidak mencukupi')
  }
  if (request.customerName.trim() === '') {
    throw mockError(API_ERROR.VALIDATION_ERROR, 400, 'Nama pemesan wajib diisi')
  }
  if (request.items.length === 0) {
    throw mockError(API_ERROR.VALIDATION_ERROR, 400, 'Pesanan tidak boleh kosong')
  }

  const items: PublicOrderItem[] = request.items.map((item, index) => {
    const menu = MENU_INDEX.get(item.menuId)
    if (!menu) {
      throw mockError(API_ERROR.VALIDATION_ERROR, 400, 'Menu tidak ditemukan')
    }
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 50) {
      throw mockError(API_ERROR.VALIDATION_ERROR, 400, 'Jumlah pesanan tidak valid')
    }
    return {
      id: `item-mock-${ORDER_STORE.nextSeq}-${index + 1}`,
      menuId: menu.id,
      menuNameSnapshot: menu.name,
      qty: item.qty,
      price: menu.price,
      status: ITEM_STATUS.PENDING,
      note: item.note ?? null,
    }
  })

  const subtotalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const serviceAmount = Math.round((subtotalAmount * OPEN_MENU.serviceRate) / 100)
  const taxAmount = Math.round(((subtotalAmount + serviceAmount) * OPEN_MENU.taxRate) / 100)

  const order: PublicOrder = {
    id: `order-mock-${ORDER_STORE.nextSeq}`,
    orderNumber: `DI-${String(ORDER_STORE.nextSeq).padStart(3, '0')}`,
    status: ORDER_STATUS.MENUNGGU,
    paymentStatus: PAYMENT_STATUS.BELUM,
    orderType: 'DINE_IN',
    customerName: request.customerName.trim(),
    subtotalAmount,
    serviceAmount,
    taxAmount,
    totalAmount: subtotalAmount + serviceAmount + taxAmount,
    paymentUrl: request.paymentMethod === PAYMENT_METHOD.NON_CASH ? 'https://snap.mock/pay' : null,
    items,
  }
  ORDER_STORE.nextSeq += 1
  ordersOf(sessionToken).unshift(order)

  return cloneOrder(order)
}

export async function getPublicOrders(sessionToken: string): Promise<PublicOrder[]> {
  await sleep()

  requireSession(sessionToken)
  return ordersOf(sessionToken).map(cloneOrder)
}

export async function cancelPublicOrder(
  sessionToken: string,
  orderId: string,
  _request: CancelPublicOrderRequest,
): Promise<OrderStatusResponse> {
  await sleep()

  requireSession(sessionToken)

  const order = ordersOf(sessionToken).find((candidate) => candidate.id === orderId)
  if (!order) {
    throw mockError(API_ERROR.NOT_FOUND, 404, 'Pesanan tidak ditemukan')
  }
  if (order.status !== ORDER_STATUS.MENUNGGU || order.paymentStatus !== PAYMENT_STATUS.BELUM) {
    throw mockError(API_ERROR.INVALID_TRANSITION, 409, 'Pesanan ini tidak bisa dibatalkan')
  }

  order.status = ORDER_STATUS.DIBATALKAN
  order.cancelReason = _request.reason.trim() || null
  order.canceledAt = new Date().toISOString()
  order.items = order.items.map((item) => ({ ...item, status: ITEM_STATUS.CANCELLED }))

  return cloneOrder(order)
}
