import { notImplemented } from '@/api/notImplemented'
import type {
  CreatePublicOrderRequest,
  CreatePublicOrderResponse,
  OrderStatusResponse,
} from '@/types/order'

export async function createPublicOrder(
  _qrToken: string,
  _request: CreatePublicOrderRequest,
): Promise<CreatePublicOrderResponse> {
  notImplemented('POST /public/tables/:qr_token/orders')
}

export async function getPublicOrder(_trackingToken: string): Promise<OrderStatusResponse> {
  notImplemented('GET /public/orders/:tracking_token')
}

export async function cancelOrderItem(
  _trackingToken: string,
  _itemId: string,
): Promise<OrderStatusResponse> {
  notImplemented('POST /public/orders/:tracking_token/cancel')
}
