import { API_ERROR_CODE } from '@/constants'
import type { Category, Menu } from '@/types'

import { ApiRequestError, request } from '../client'

type ServerCategory = { id: string; name: string; sort_order: number }

type ServerMenu = {
  id: string
  category_id: string
  name: string
  price: number
  image_url?: string | null
  is_available: boolean
}

const toMenu = (menu: ServerMenu): Menu => ({
  id: menu.id,
  name: menu.name,
  price: menu.price,
  image_url: menu.image_url ?? null,
  is_available: menu.is_available,
})

/** The API returns flat lists; the dashboard groups menus under their category. */
export const getMenuCategories = async (): Promise<Category[]> => {
  const [categories, menus] = await Promise.all([
    request<ServerCategory[]>({ method: 'GET', url: '/menu-categories' }),
    request<ServerMenu[]>({ method: 'GET', url: '/menus' }),
  ])
  return [...categories]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((category) => ({
      id: category.id,
      name: category.name,
      sort_order: category.sort_order,
      menus: menus.filter((menu) => menu.category_id === category.id).map(toMenu),
    }))
}

export const createCategory = async ({ name }: { name: string }): Promise<Category> => {
  const category = await request<ServerCategory>({
    method: 'POST',
    url: '/menu-categories',
    data: { name },
  })
  return { ...category, menus: [] }
}

export const updateCategory = async (
  id: string,
  { name, sort_order }: { name: string; sort_order?: number },
): Promise<Category> => {
  const category = await request<ServerCategory>({
    method: 'PATCH',
    url: `/menu-categories/${id}`,
    data: { name, sort_order },
  })
  return { ...category, menus: [] }
}

export const deleteCategory = async (id: string): Promise<void> => {
  await request<void>({ method: 'DELETE', url: `/menu-categories/${id}` })
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
  const menu = await request<ServerMenu>({
    method: 'POST',
    url: '/menus',
    data: { name, price, category_id, image_url },
  })
  return toMenu(menu)
}

export const updateMenu = async (
  id: string,
  body: {
    name?: string
    price?: number
    is_available?: boolean
    image_url?: string | null
    category_id?: string
  },
): Promise<Menu> => {
  const menus = await request<ServerMenu[]>({ method: 'GET', url: '/menus' })
  const current = menus.find((menu) => menu.id === id)
  if (!current) throw new ApiRequestError(API_ERROR_CODE.NOT_FOUND, 'Menu tidak ditemukan')
  const menu = await request<ServerMenu>({
    method: 'PATCH',
    url: `/menus/${id}`,
    data: {
      name: current.name,
      price: current.price,
      category_id: current.category_id,
      image_url: current.image_url ?? null,
      is_available: current.is_available,
      ...body,
    },
  })
  return toMenu(menu)
}

export const deleteMenu = async (id: string): Promise<void> => {
  await request<void>({ method: 'DELETE', url: `/menus/${id}` })
}
