export const ITEM_STATUS = {
  PENDING: 'PENDING',
  COOKING: 'COOKING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS]

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  PENDING: 'Menunggu',
  COOKING: 'Diproses',
  READY: 'Siap',
  DELIVERED: 'Diantar',
  CANCELLED: 'Dibatalkan',
}
