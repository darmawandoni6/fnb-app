import { ITEM_STATUS } from '@/constants/itemStatus'
import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import type { PublicOrder } from '@/types/order'

const base = {
  orderType: 'DINE_IN' as const,
  customerName: 'Budi',
  serviceAmount: 0,
  paymentUrl: null,
}

export const SEEDED_ORDERS: PublicOrder[] = [
  {
    ...base,
    id: 'order-menunggu',
    orderNumber: 'DI-001',
    status: ORDER_STATUS.MENUNGGU,
    paymentStatus: PAYMENT_STATUS.BELUM,
    subtotalAmount: 81000,
    serviceAmount: 4050,
    taxAmount: 8505,
    totalAmount: 93555,
    items: [
      {
        id: 'item-menunggu-1',
        menuId: 'menu-latte',
        menuNameSnapshot: 'Latte',
        qty: 2,
        price: 28000,
        status: ITEM_STATUS.PENDING,
        note: 'less sugar',
      },
      {
        id: 'item-menunggu-2',
        menuId: 'menu-croissant',
        menuNameSnapshot: 'Croissant',
        qty: 1,
        price: 25000,
        status: ITEM_STATUS.PENDING,
        note: null,
      },
    ],
  },
  {
    ...base,
    id: 'order-diproses',
    orderNumber: 'DI-002',
    status: ORDER_STATUS.DIPROSES,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 42000,
    serviceAmount: 2100,
    taxAmount: 4410,
    totalAmount: 48510,
    items: [
      {
        id: 'item-diproses-1',
        menuId: 'menu-americano',
        menuNameSnapshot: 'Americano',
        qty: 1,
        price: 22000,
        status: ITEM_STATUS.COOKING,
        note: null,
      },
      {
        id: 'item-diproses-2',
        menuId: 'menu-pisang-goreng',
        menuNameSnapshot: 'Pisang Goreng',
        qty: 1,
        price: 20000,
        status: ITEM_STATUS.READY,
        note: 'extra cheese',
      },
    ],
  },
  {
    ...base,
    id: 'order-siap',
    orderNumber: 'DI-003',
    status: ORDER_STATUS.DIPROSES,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 32000,
    serviceAmount: 1600,
    taxAmount: 3360,
    totalAmount: 36960,
    items: [
      {
        id: 'item-siap-1',
        menuId: 'menu-matcha',
        menuNameSnapshot: 'Matcha Latte',
        qty: 1,
        price: 32000,
        status: ITEM_STATUS.READY,
        note: null,
      },
    ],
  },
  {
    ...base,
    id: 'order-diantar',
    orderNumber: 'DI-004',
    status: ORDER_STATUS.DIPROSES,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 50000,
    serviceAmount: 2500,
    taxAmount: 5250,
    totalAmount: 57750,
    items: [
      {
        id: 'item-diantar-1',
        menuId: 'menu-nasi-goreng',
        menuNameSnapshot: 'Nasi Goreng Senja',
        qty: 1,
        price: 35000,
        status: ITEM_STATUS.DELIVERED,
        note: 'pedas',
      },
      {
        id: 'item-diantar-2',
        menuId: 'menu-teh',
        menuNameSnapshot: 'Teh Melati',
        qty: 1,
        price: 15000,
        status: ITEM_STATUS.DELIVERED,
        note: null,
      },
    ],
  },
  {
    ...base,
    id: 'order-selesai',
    orderNumber: 'DI-005',
    status: ORDER_STATUS.SELESAI,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 18000,
    serviceAmount: 900,
    taxAmount: 1890,
    totalAmount: 20790,
    items: [
      {
        id: 'item-selesai-1',
        menuId: 'menu-espresso',
        menuNameSnapshot: 'Espresso',
        qty: 1,
        price: 18000,
        status: ITEM_STATUS.COMPLETED,
        note: null,
      },
    ],
  },
  {
    ...base,
    id: 'order-dibatalkan',
    orderNumber: 'DI-006',
    status: ORDER_STATUS.DIBATALKAN,
    paymentStatus: PAYMENT_STATUS.BELUM,
    subtotalAmount: 27000,
    serviceAmount: 1350,
    taxAmount: 2835,
    totalAmount: 31185,
    items: [
      {
        id: 'item-dibatalkan-1',
        menuId: 'menu-chocolate',
        menuNameSnapshot: 'Chocolate',
        qty: 1,
        price: 27000,
        status: ITEM_STATUS.CANCELLED,
        note: null,
      },
    ],
  },
]

// Orders are scoped to an issued session token; a new session starts with none.
export const ORDER_STORE = {
  bySession: new Map<string, PublicOrder[]>(),
  nextSeq: 1,
}
