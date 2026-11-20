import { OPEN_MENU } from '@/mocks/data/menus'
import { ORDER_STORE } from '@/mocks/data/orders'

import { API_ERROR } from '@/constants/errors'
import { ITEM_STATUS } from '@/constants/itemStatus'
import { MOCK_TABLE_TOKEN } from '@/constants/mockTokens'
import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import { mockError } from '@/lib/apiError'
import type {
  CreatePublicOrderRequest,
  CreatePublicOrderResponse,
  OrderStatusResponse,
  PublicOrderItem,
} from '@/types/order'

import { sleep } from './index'

const MENU_INDEX = new Map(
  OPEN_MENU.categories.flatMap((category) =>
    category.menus.map((menu) => [menu.id, menu] as const),
  ),
)

function cloneOrder(order: OrderStatusResponse): OrderStatusResponse {
  return structuredClone(order)
}

export async function createPublicOrder(
  qrToken: string,
  request: CreatePublicOrderRequest,
): Promise<CreatePublicOrderResponse> {
  await sleep()

  if (qrToken === MOCK_TABLE_TOKEN.CLOSED) {
    throw mockError(API_ERROR.STORE_CLOSED, 409, 'Toko sedang tutup')
  }
  if (qrToken === MOCK_TABLE_TOKEN.OUT_OF_STOCK) {
    throw mockError(API_ERROR.STOCK_NOT_ENOUGH, 409, 'Stok bahan tidak mencukupi')
  }
  if (qrToken !== MOCK_TABLE_TOKEN.OPEN) {
    throw mockError(API_ERROR.NOT_FOUND, 404, 'QR meja tidak ditemukan')
  }
  if (request.items.length === 0) {
    throw mockError(API_ERROR.VALIDATION_ERROR, 400, 'Pesanan tidak boleh kosong')
  }

  const items: PublicOrderItem[] = request.items.map((item, index) => {
    const menu = MENU_INDEX.get(item.menuId)
    if (!menu) {
      throw mockError(API_ERROR.VALIDATION_ERROR, 400, 'Menu tidak ditemukan')
    }
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100) {
      throw mockError(API_ERROR.VALIDATION_ERROR, 400, 'Jumlah pesanan tidak valid')
    }
    return {
      id: `item-mock-${ORDER_STORE.nextSeq}-${index + 1}`,
      menuName: menu.name,
      qty: item.qty,
      price: menu.price,
      status: ITEM_STATUS.PENDING,
      note: item.note ?? null,
    }
  })

  const subtotalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const taxAmount = Math.round((subtotalAmount * OPEN_MENU.taxPercent) / 100)

  const order: OrderStatusResponse = {
    orderId: `order-mock-${ORDER_STORE.nextSeq}`,
    status: ORDER_STATUS.MENUNGGU,
    paymentStatus: PAYMENT_STATUS.BELUM,
    subtotalAmount,
    taxAmount,
    totalAmount: subtotalAmount + taxAmount,
    items,
  }
  const trackingToken = `tracking-mock-${ORDER_STORE.nextSeq}`
  ORDER_STORE.nextSeq += 1
  ORDER_STORE.store.set(trackingToken, order)

  return { ...cloneOrder(order), trackingToken }
}

export async function getPublicOrder(trackingToken: string): Promise<OrderStatusResponse> {
  await sleep()

  const order = ORDER_STORE.store.get(trackingToken)
  if (!order) {
    throw mockError(API_ERROR.NOT_FOUND, 404, 'Pesanan tidak ditemukan')
  }
  return cloneOrder(order)
}

export async function cancelOrderItem(
  trackingToken: string,
  itemId: string,
): Promise<OrderStatusResponse> {
  await sleep()

  const order = ORDER_STORE.store.get(trackingToken)
  if (!order) {
    throw mockError(API_ERROR.NOT_FOUND, 404, 'Pesanan tidak ditemukan')
  }

  const item = order.items.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw mockError(API_ERROR.NOT_FOUND, 404, 'Item pesanan tidak ditemukan')
  }
  if (item.status !== ITEM_STATUS.PENDING) {
    throw mockError(API_ERROR.INVALID_TRANSITION, 409, 'Item ini tidak bisa dibatalkan')
  }

  item.status = ITEM_STATUS.CANCELLED

  if (order.paymentStatus === PAYMENT_STATUS.LUNAS) {
    const subtotalAmount = order.items
      .filter((candidate) => candidate.status !== ITEM_STATUS.CANCELLED)
      .reduce((sum, candidate) => sum + candidate.price * candidate.qty, 0)
    order.subtotalAmount = subtotalAmount
    order.taxAmount = Math.round((subtotalAmount * OPEN_MENU.taxPercent) / 100)
    order.totalAmount = subtotalAmount + order.taxAmount
  }

  if (order.items.every((candidate) => candidate.status === ITEM_STATUS.CANCELLED)) {
    order.status = ORDER_STATUS.DIBATALKAN
  }

  return cloneOrder(order)
}
