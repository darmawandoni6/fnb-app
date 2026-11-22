import type { ItemStatus, OrderStatus, OrderType, PaymentMethod } from '@/constants'
import type { Order, OrderItem } from '@/types'

import { request } from '../client'

type OrderFilters = {
  status?: OrderStatus
  table_id?: string
  order_type?: OrderType
  date?: string
}

type ServerOrderItem = {
  id: string
  menu_id: string
  menu_name: string
  qty: number
  price: number
  note: string | null
  status: OrderItem['status']
  ready_at?: string | null
  delivered_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
}

export type ServerOrder = {
  id: string
  order_number: string
  order_type: OrderType
  table_id?: string | null
  table_number?: string | null
  created_by?: string | null
  customer_name: string
  customer_phone?: string | null
  status: OrderStatus
  payment_status: Order['payment_status']
  payment_method?: Order['payment_method']
  payment_ref?: string | null
  paid_at?: string | null
  amount_received?: number | null
  change_amount?: number | null
  subtotal_amount: number
  service_amount: number
  tax_amount: number
  total_amount: number
  service_rate_snapshot: number
  tax_rate_snapshot: number
  cancel_reason?: string | null
  canceled_at?: string | null
  created_at: string
  items: ServerOrderItem[]
}

const toOrderItem = (item: ServerOrderItem): OrderItem => ({
  id: item.id,
  menu_id: item.menu_id,
  menu_name_snapshot: item.menu_name,
  qty: item.qty,
  price: item.price,
  note: item.note,
  status: item.status,
  ready_at: item.ready_at ?? null,
  delivered_at: item.delivered_at ?? null,
  completed_at: item.completed_at ?? null,
  cancelled_at: item.cancelled_at ?? null,
})

export const toOrder = (order: ServerOrder): Order => ({
  id: order.id,
  order_number: order.order_number,
  order_type: order.order_type,
  table_id: order.table_id ?? null,
  table_number: order.table_number ?? null,
  table_session_id: null,
  created_by: order.created_by ?? null,
  created_by_name: null,
  customer_name: order.customer_name,
  customer_phone: order.customer_phone ?? null,
  status: order.status,
  payment_status: order.payment_status,
  payment_method: order.payment_method ?? null,
  payment_ref: order.payment_ref ?? null,
  paid_at: order.paid_at ?? null,
  amount_received: order.amount_received ?? null,
  change_amount: order.change_amount ?? null,
  cancel_reason: order.cancel_reason ?? null,
  canceled_at: order.canceled_at ?? null,
  subtotal_amount: order.subtotal_amount,
  service_rate_snapshot: order.service_rate_snapshot,
  service_amount: order.service_amount,
  tax_rate_snapshot: order.tax_rate_snapshot,
  tax_amount: order.tax_amount,
  total_amount: order.total_amount,
  created_at: order.created_at,
  items: order.items.map(toOrderItem),
})

export const getOrders = async (filters: OrderFilters = {}): Promise<Order[]> => {
  const orders = await request<ServerOrder[]>({ method: 'GET', url: '/orders', params: filters })
  return orders.map(toOrder)
}

export const getOrder = async (id: string): Promise<Order> => {
  const order = await request<ServerOrder>({ method: 'GET', url: `/orders/${id}` })
  return toOrder(order)
}

export const updateItemStatus = async (
  orderId: string,
  itemId: string,
  status: ItemStatus,
): Promise<Order> => {
  const order = await request<ServerOrder>({
    method: 'PATCH',
    url: `/orders/${orderId}/items/${itemId}/status`,
    data: { status },
  })
  return toOrder(order)
}

type CreateManualOrderInput = {
  items: { menu_id: string; qty: number; note: string | null }[]
  customer_name: string
  customer_phone?: string | null
  payment_method?: PaymentMethod
}

export const createManualOrder = async (body: CreateManualOrderInput): Promise<Order> => {
  const order = await request<ServerOrder>({
    method: 'POST',
    url: '/orders/manual',
    data: { ...body, payment_method: body.payment_method ?? 'CASH' },
  })
  return toOrder(order)
}

export const cancelOrder = async (id: string, reason: string): Promise<Order> => {
  const order = await request<ServerOrder>({
    method: 'POST',
    url: `/orders/${id}/cancel`,
    data: { reason },
  })
  return toOrder(order)
}
