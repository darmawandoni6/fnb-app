import type { ItemStatus } from '@/constants/itemStatus'
import type { OrderStatus } from '@/constants/orderStatus'
import type { PaymentMethod } from '@/constants/paymentMethod'
import type { PaymentStatus } from '@/constants/paymentStatus'

export type OpenSessionResponse = {
  sessionToken: string
  tableNumber: string
  status: string
}

export type PublicOrderItem = {
  id: string
  menuId: string
  menuNameSnapshot: string
  qty: number
  price: number
  status: ItemStatus
  note: string | null
}

export type PublicOrder = {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  orderType: string
  customerName: string
  subtotalAmount: number
  serviceAmount: number
  taxAmount: number
  totalAmount: number
  paymentUrl: string | null
  cancelReason?: string | null
  canceledAt?: string | null
  items: PublicOrderItem[]
}

export type OrderStatusResponse = PublicOrder

export type PublicOrderList = PublicOrder[]

export type CreatePublicOrderItemRequest = {
  menuId: string
  qty: number
  note?: string | null
}

export type CreatePublicOrderRequest = {
  orderType: 'DINE_IN'
  customerName: string
  customerPhone: string | null
  paymentMethod: PaymentMethod
  items: CreatePublicOrderItemRequest[]
}

export type CancelPublicOrderRequest = {
  reason: string
}
