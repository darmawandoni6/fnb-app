import type { Category, Menu } from '@/types'

export const menus: Menu[] = [
  { id: 'menu-1', name: 'Kopi Susu', price: 18000, image_url: null, is_available: true },
  { id: 'menu-2', name: 'Americano', price: 15000, image_url: null, is_available: true },
  { id: 'menu-3', name: 'Matcha Latte', price: 22000, image_url: null, is_available: true },
  { id: 'menu-4', name: 'Teh Lemon', price: 12000, image_url: null, is_available: false },
  { id: 'menu-5', name: 'Nasi Goreng', price: 28000, image_url: null, is_available: true },
  { id: 'menu-6', name: 'Kentang Goreng', price: 20000, image_url: null, is_available: true },
]

export const categories: Category[] = [
  { id: 'category-1', name: 'Coffee', menus: menus.slice(0, 2) },
  { id: 'category-2', name: 'Non-Coffee', menus: menus.slice(2, 4) },
  { id: 'category-3', name: 'Food', menus: menus.slice(4) },
]
