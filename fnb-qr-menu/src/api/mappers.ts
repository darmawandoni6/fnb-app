import type { ItemStatus } from '@/constants/itemStatus'
import type { OrderStatus } from '@/constants/orderStatus'
import type { PaymentStatus } from '@/constants/paymentStatus'
import type { MenuItem, PublicMenu } from '@/types/menu'
import type {
  CreatePublicOrderRequest,
  OpenSessionResponse,
  PublicOrder,
  PublicOrderItem,
} from '@/types/order'

type RawMenuItem = { id: string; name: string; price: number; image_url: string | null }
type RawMenuCategory = { id: string; name: string; menus: RawMenuItem[] }
export type RawMenu = {
  cafe_name: string
  service_rate: number
  tax_rate: number
  is_open: boolean
  categories: RawMenuCategory[]
}

export type RawOpenSession = { session_token: string; table_number: string; status: string }

export type RawOrderItem = {
  id: string
  menu_id: string
  menu_name_snapshot?: string
  menu_name?: string
  qty: number
  price: number
  status: ItemStatus
  note: string | null
}

export type RawOrder = {
  id: string
  order_number: string
  status: OrderStatus
  payment_status: PaymentStatus
  order_type?: string
  customer_name?: string
  subtotal_amount: number
  service_amount: number
  tax_amount: number
  total_amount: number
  payment_url?: string | null
  cancel_reason?: string | null
  canceled_at?: string | null
  items: RawOrderItem[]
}

export type RawCreateOrderRequest = {
  order_type: 'DINE_IN'
  customer_name: string
  customer_phone: string | null
  payment_method: string
  items: { menu_id: string; qty: number; note: string | null }[]
}

export function toPublicMenu(raw: RawMenu): PublicMenu {
  return {
    cafeName: raw.cafe_name,
    serviceRate: raw.service_rate,
    taxRate: raw.tax_rate,
    isOpen: raw.is_open,
    categories: raw.categories.map((category) => ({
      id: category.id,
      name: category.name,
      menus: category.menus.map((menu): MenuItem => ({
        id: menu.id,
        name: menu.name,
        price: menu.price,
        imageUrl: menu.image_url,
      })),
    })),
  }
}

export function toOpenSession(raw: RawOpenSession): OpenSessionResponse {
  return {
    sessionToken: raw.session_token,
    tableNumber: raw.table_number,
    status: raw.status,
  }
}

export function toPublicOrder(raw: RawOrder): PublicOrder {
  return {
    id: raw.id,
    orderNumber: raw.order_number,
    status: raw.status,
    paymentStatus: raw.payment_status,
    orderType: raw.order_type ?? 'DINE_IN',
    customerName: raw.customer_name ?? '',
    subtotalAmount: raw.subtotal_amount,
    serviceAmount: raw.service_amount,
    taxAmount: raw.tax_amount,
    totalAmount: raw.total_amount,
    paymentUrl: raw.payment_url ?? null,
    cancelReason: raw.cancel_reason ?? null,
    canceledAt: raw.canceled_at ?? null,
    items: raw.items.map((item): PublicOrderItem => ({
      id: item.id,
      menuId: item.menu_id,
      menuNameSnapshot: item.menu_name_snapshot ?? item.menu_name ?? '',
      qty: item.qty,
      price: item.price,
      status: item.status,
      note: item.note,
    })),
  }
}

export function toCreateOrderRequest(request: CreatePublicOrderRequest): RawCreateOrderRequest {
  return {
    order_type: request.orderType,
    customer_name: request.customerName,
    customer_phone: request.customerPhone,
    payment_method: request.paymentMethod,
    items: request.items.map((item) => ({
      menu_id: item.menuId,
      qty: item.qty,
      note: item.note ?? null,
    })),
  }
}
