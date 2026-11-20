import { expect, test } from 'vitest'

import { API_ERROR } from '@/constants/errors'
import { MOCK_TABLE_TOKEN } from '@/constants/mockTokens'

import { getPublicMenu } from './publicMenu'

test('returns the open store for demo-meja', async () => {
  const menu = await getPublicMenu(MOCK_TABLE_TOKEN.OPEN)

  expect(menu.isOpen).toBe(true)
  expect(menu.cafeName).toBe('Kopi Senja')
  expect(menu.categories.length).toBeGreaterThan(0)
  expect(menu.categories.every((category) => category.menus.length > 0)).toBe(true)
})

test('returns a closed store for demo-tutup', async () => {
  const menu = await getPublicMenu(MOCK_TABLE_TOKEN.CLOSED)
  expect(menu.isOpen).toBe(false)
})

test('keeps the store open for demo-habis', async () => {
  const menu = await getPublicMenu(MOCK_TABLE_TOKEN.OUT_OF_STOCK)
  expect(menu.isOpen).toBe(true)
})

test('rejects demo-invalid and unknown tokens with NOT_FOUND', async () => {
  await expect(getPublicMenu(MOCK_TABLE_TOKEN.INVALID)).rejects.toMatchObject({
    code: API_ERROR.NOT_FOUND,
  })
  await expect(getPublicMenu('token-tidak-dikenal')).rejects.toMatchObject({
    code: API_ERROR.NOT_FOUND,
  })
})
