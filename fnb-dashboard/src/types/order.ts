import type { ItemStatus, OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '@/constants'

export type OrderItem = {
  id: string
  menu_id: string
  menu_name_snapshot: string
  qty: number
  price: number
  note: string | null
  status: ItemStatus
  ready_at: string | null
  delivered_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export type Order = {
  id: string
  order_number: string
  order_type: OrderType
  table_id: string | null
  table_number: string | null
  table_session_id: string | null
  created_by: string | null
  created_by_name: string | null
  customer_name: string
  customer_phone: string | null
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  payment_ref: string | null
  paid_at: string | null
  amount_received: number | null
  change_amount: number | null
  cancel_reason: string | null
  canceled_at: string | null
  subtotal_amount: number
  service_rate_snapshot: number
  service_amount: number
  tax_rate_snapshot: number
  tax_amount: number
  total_amount: number
  created_at: string
  items: OrderItem[]
}
