import type {
  CancelPublicOrderRequest,
  CreatePublicOrderRequest,
  OrderStatusResponse,
  PublicOrder,
} from '@/types/order'

import { request } from './client'
import { toCreateOrderRequest, toPublicOrder } from './mappers'
import type { RawOrder } from './mappers'

export async function createPublicOrder(
  sessionToken: string,
  order: CreatePublicOrderRequest,
): Promise<OrderStatusResponse> {
  const raw = await request<RawOrder>(
    { method: 'POST', url: '/public/orders', data: toCreateOrderRequest(order) },
    sessionToken,
  )
  return toPublicOrder(raw)
}

export async function getPublicOrders(sessionToken: string): Promise<PublicOrder[]> {
  const raw = await request<RawOrder[]>({ method: 'GET', url: '/public/orders' }, sessionToken)
  return raw.map(toPublicOrder)
}

export async function cancelPublicOrder(
  sessionToken: string,
  orderId: string,
  body: CancelPublicOrderRequest,
): Promise<OrderStatusResponse> {
  const raw = await request<RawOrder>(
    { method: 'POST', url: `/public/orders/${encodeURIComponent(orderId)}/cancel`, data: body },
    sessionToken,
  )
  return toPublicOrder(raw)
}
