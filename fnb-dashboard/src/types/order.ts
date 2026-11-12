import type { ItemStatus, OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '@/constants'

export type OrderItem = {
  id: string
  menu_id: string
  menu_name: string
  qty: number
  unit_price: number
  note: string | null
  status: ItemStatus
}

export type Order = {
  id: string
  order_type: OrderType
  table_id: string | null
  table_number: string | null
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  subtotal_amount: number
  tax_amount: number
  tax_percent: number
  total_amount: number
  created_at: string
  items: OrderItem[]
}
