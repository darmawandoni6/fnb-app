import type { ItemStatus } from '@/constants/itemStatus'
import type { OrderStatus } from '@/constants/orderStatus'
import type { PaymentStatus } from '@/constants/paymentStatus'

export type PublicOrderItem = {
  id: string
  menuName: string
  qty: number
  price: number
  status: ItemStatus
  note: string | null
}

export type PublicOrder = {
  orderId: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  items: PublicOrderItem[]
}

export type OrderStatusResponse = PublicOrder

export type CreatePublicOrderResponse = PublicOrder & {
  trackingToken: string
}

export type CreatePublicOrderItemRequest = {
  menuId: string
  qty: number
  note?: string | null
}

export type CreatePublicOrderRequest = {
  items: CreatePublicOrderItemRequest[]
}
