import { ITEM_STATUS } from '@/constants/itemStatus'
import { ORDER_STATUS } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import type { OrderStatusResponse } from '@/types/order'

export const SEEDED_ORDERS: OrderStatusResponse[] = [
  {
    orderId: 'order-menunggu',
    status: ORDER_STATUS.MENUNGGU,
    paymentStatus: PAYMENT_STATUS.BELUM,
    subtotalAmount: 81000,
    taxAmount: 8100,
    totalAmount: 89100,
    items: [
      {
        id: 'item-menunggu-1',
        menuName: 'Latte',
        qty: 2,
        price: 28000,
        status: ITEM_STATUS.PENDING,
        note: 'less sugar',
      },
      {
        id: 'item-menunggu-2',
        menuName: 'Croissant',
        qty: 1,
        price: 25000,
        status: ITEM_STATUS.PENDING,
        note: null,
      },
    ],
  },
  {
    orderId: 'order-diproses',
    status: ORDER_STATUS.DIPROSES,
    paymentStatus: PAYMENT_STATUS.BELUM,
    subtotalAmount: 42000,
    taxAmount: 4200,
    totalAmount: 46200,
    items: [
      {
        id: 'item-diproses-1',
        menuName: 'Americano',
        qty: 1,
        price: 22000,
        status: ITEM_STATUS.COOKING,
        note: null,
      },
      {
        id: 'item-diproses-2',
        menuName: 'Pisang Goreng',
        qty: 1,
        price: 20000,
        status: ITEM_STATUS.READY,
        note: 'extra cheese',
      },
    ],
  },
  {
    orderId: 'order-siap',
    status: ORDER_STATUS.SIAP,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 32000,
    taxAmount: 3200,
    totalAmount: 35200,
    items: [
      {
        id: 'item-siap-1',
        menuName: 'Matcha Latte',
        qty: 1,
        price: 32000,
        status: ITEM_STATUS.READY,
        note: null,
      },
    ],
  },
  {
    orderId: 'order-diantar',
    status: ORDER_STATUS.DIANTAR,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 50000,
    taxAmount: 5000,
    totalAmount: 55000,
    items: [
      {
        id: 'item-diantar-1',
        menuName: 'Nasi Goreng Senja',
        qty: 1,
        price: 35000,
        status: ITEM_STATUS.DELIVERED,
        note: 'pedas',
      },
      {
        id: 'item-diantar-2',
        menuName: 'Teh Melati',
        qty: 1,
        price: 15000,
        status: ITEM_STATUS.DELIVERED,
        note: null,
      },
    ],
  },
  {
    orderId: 'order-selesai',
    status: ORDER_STATUS.SELESAI,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 18000,
    taxAmount: 1800,
    totalAmount: 19800,
    items: [
      {
        id: 'item-selesai-1',
        menuName: 'Espresso',
        qty: 1,
        price: 18000,
        status: ITEM_STATUS.DELIVERED,
        note: null,
      },
    ],
  },
  {
    orderId: 'order-dibatalkan',
    status: ORDER_STATUS.DIBATALKAN,
    paymentStatus: PAYMENT_STATUS.BELUM,
    subtotalAmount: 27000,
    taxAmount: 2700,
    totalAmount: 29700,
    items: [
      {
        id: 'item-dibatalkan-1',
        menuName: 'Chocolate',
        qty: 1,
        price: 27000,
        status: ITEM_STATUS.CANCELLED,
        note: null,
      },
    ],
  },
  {
    orderId: 'order-lunas',
    status: ORDER_STATUS.MENUNGGU,
    paymentStatus: PAYMENT_STATUS.LUNAS,
    subtotalAmount: 28000,
    taxAmount: 2800,
    totalAmount: 30800,
    items: [
      {
        id: 'item-lunas-1',
        menuName: 'Cappuccino',
        qty: 1,
        price: 28000,
        status: ITEM_STATUS.PENDING,
        note: 'oat milk',
      },
    ],
  },
]

export const ORDER_STORE = {
  store: new Map<string, OrderStatusResponse>(),
  nextSeq: 1,
}

for (const order of SEEDED_ORDERS) {
  const trackingToken = `demo-${order.orderId.replace('order-', '')}`
  ORDER_STORE.store.set(trackingToken, order)
}
