import { notImplemented } from '@/api/notImplemented'
import type {
  CancelPublicOrderRequest,
  CreatePublicOrderRequest,
  OrderStatusResponse,
  PublicOrder,
} from '@/types/order'

export async function createPublicOrder(
  _sessionToken: string,
  _request: CreatePublicOrderRequest,
): Promise<OrderStatusResponse> {
  notImplemented('POST /public/orders')
}

export async function getPublicOrders(_sessionToken: string): Promise<PublicOrder[]> {
  notImplemented('GET /public/orders')
}

export async function cancelPublicOrder(
  _sessionToken: string,
  _orderId: string,
  _request: CancelPublicOrderRequest,
): Promise<OrderStatusResponse> {
  notImplemented('POST /public/orders/:id/cancel')
}
