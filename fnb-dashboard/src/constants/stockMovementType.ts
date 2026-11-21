export const STOCK_MOVEMENT_TYPE = {
  IN: 'IN',
  OUT: 'OUT',
  RESTORE: 'RESTORE',
  ADJUSTMENT: 'ADJUSTMENT',
} as const

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE)[keyof typeof STOCK_MOVEMENT_TYPE]
