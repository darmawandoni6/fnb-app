export const ITEM_STATUS = {
  PENDING: 'PENDING',
  COOKING: 'COOKING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS]

/** Terminal item states: an order is SELESAI when every item is here (PRD §5.3). */
export const TERMINAL_ITEM_STATUS = [ITEM_STATUS.COMPLETED, ITEM_STATUS.CANCELLED] as const
