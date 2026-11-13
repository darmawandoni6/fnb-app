import { db } from '@/mocks/db'
import type { Category } from '@/types'

import { delay } from './shared'

export const getMenuCategories = async (): Promise<Category[]> => {
  await delay()
  return db.categories.map((category) => ({
    ...category,
    menus: category.menus.map((menu) => ({ ...menu })),
  }))
}
