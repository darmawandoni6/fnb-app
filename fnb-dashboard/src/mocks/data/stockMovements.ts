import type { StockMovement } from '@/types'

export const stockMovements: StockMovement[] = [
  {
    id: 'movement-1',
    ingredient_id: 'ingredient-1',
    type: 'IN',
    qty: 500,
    created_at: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'movement-2',
    ingredient_id: 'ingredient-2',
    type: 'IN',
    qty: 2000,
    created_at: '2026-01-01T08:05:00.000Z',
  },
  {
    id: 'movement-3',
    ingredient_id: 'ingredient-3',
    type: 'IN',
    qty: 3000,
    created_at: '2026-01-01T08:10:00.000Z',
  },
]
