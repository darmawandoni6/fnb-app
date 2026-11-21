import { expect, test } from 'vitest'

import { API_ERROR } from '@/constants/errors'
import { MOCK_TABLE_TOKEN } from '@/constants/mockTokens'

import { getPublicMenu } from './publicMenu'
import { openTableSession } from './session'

test('returns the open store for demo-meja', async () => {
  const { sessionToken, tableNumber } = await openTableSession(MOCK_TABLE_TOKEN.OPEN)
  expect(tableNumber).toBeTruthy()

  const menu = await getPublicMenu(sessionToken)

  expect(menu.isOpen).toBe(true)
  expect(menu.cafeName).toBe('Kopi Senja')
  expect(menu.categories.length).toBeGreaterThan(0)
  expect(menu.categories.every((category) => category.menus.length > 0)).toBe(true)
})

test('returns a closed store for demo-tutup', async () => {
  const { sessionToken } = await openTableSession(MOCK_TABLE_TOKEN.CLOSED)
  const menu = await getPublicMenu(sessionToken)
  expect(menu.isOpen).toBe(false)
})

test('keeps the store open for demo-habis', async () => {
  const { sessionToken } = await openTableSession(MOCK_TABLE_TOKEN.OUT_OF_STOCK)
  const menu = await getPublicMenu(sessionToken)
  expect(menu.isOpen).toBe(true)
})

test('rejects demo-invalid and unknown tables at session open', async () => {
  await expect(openTableSession(MOCK_TABLE_TOKEN.INVALID)).rejects.toMatchObject({
    code: API_ERROR.NOT_FOUND,
  })
  await expect(openTableSession('unknown-token')).rejects.toMatchObject({
    code: API_ERROR.NOT_FOUND,
  })
})

test('an unknown session token is unauthorized', async () => {
  await expect(getPublicMenu('missing-session')).rejects.toMatchObject({
    code: API_ERROR.UNAUTHORIZED,
  })
})
