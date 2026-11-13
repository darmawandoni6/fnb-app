import { API_ERROR_CODE, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Category, Menu } from '@/types'

import { delay, fail, findOrThrow, requireRole } from './shared'

export const getMenuCategories = async (): Promise<Category[]> => {
  await delay()
  return db.categories.map((category) => ({
    ...category,
    menus: category.menus.map((menu) => ({ ...menu })),
  }))
}

export const createCategory = async ({ name }: { name: string }): Promise<Category> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama kategori wajib diisi')
  const category = { id: `category-${Date.now()}`, name, menus: [] }
  db.categories.push(category)
  return { ...category, menus: [] }
}

export const updateCategory = async (id: string, { name }: { name: string }): Promise<Category> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama kategori wajib diisi')
  const category = findOrThrow(
    db.categories.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Kategori tidak ditemukan',
  )
  category.name = name
  return { ...category, menus: category.menus.map((menu) => ({ ...menu })) }
}

export const deleteCategory = async (id: string): Promise<void> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const category = findOrThrow(
    db.categories.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Kategori tidak ditemukan',
  )
  if (category.menus.length > 0)
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Kategori masih memiliki menu')
  db.categories = db.categories.filter((candidate) => candidate.id !== id)
}

export const createMenu = async ({
  name,
  price,
  category_id,
  image_url,
}: {
  name: string
  price: number
  category_id: string
  image_url: string | null
}): Promise<Menu> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const category = findOrThrow(
    db.categories.find((candidate) => candidate.id === category_id),
    API_ERROR_CODE.NOT_FOUND,
    'Kategori tidak ditemukan',
  )
  if (!name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama menu wajib diisi')
  if (!Number.isInteger(price) || price < 0)
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Harga tidak valid')
  const menu: Menu = { id: `menu-${Date.now()}`, name, price, image_url, is_available: true }
  db.menus.push(menu)
  category.menus.push(menu)
  return { ...menu }
}

export const updateMenu = async (
  id: string,
  body: { name?: string; price?: number; is_available?: boolean; image_url?: string | null },
): Promise<Menu> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const menu = findOrThrow(
    db.menus.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Menu tidak ditemukan',
  )
  if (body.name !== undefined) {
    if (!body.name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama menu wajib diisi')
    menu.name = body.name
  }
  if (body.price !== undefined) {
    if (!Number.isInteger(body.price) || body.price < 0)
      fail(API_ERROR_CODE.VALIDATION_ERROR, 'Harga tidak valid')
    menu.price = body.price
  }
  if (body.is_available !== undefined) menu.is_available = body.is_available
  if (body.image_url !== undefined) menu.image_url = body.image_url
  return { ...menu }
}

export const deleteMenu = async (id: string): Promise<void> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const menu = findOrThrow(
    db.menus.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Menu tidak ditemukan',
  )
  menu.is_available = false
}
