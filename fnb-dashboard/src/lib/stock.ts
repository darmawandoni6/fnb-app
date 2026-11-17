import type { Ingredient } from '@/types'

export type StockStatus = 'out' | 'low' | 'ok'

export const getStockStatus = ({ stock_qty, min_stock }: Ingredient): StockStatus => {
  if (stock_qty === 0) return 'out'
  if (stock_qty <= min_stock) return 'low'
  return 'ok'
}
