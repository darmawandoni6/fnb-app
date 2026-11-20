import { beforeEach, expect, test, vi } from 'vitest'

import { SESSION_STORAGE_KEY } from '@/constants/storage'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

test('round-trips a cart line through storage', async () => {
  const { getSession, updateSession } = await import('./store')

  updateSession((prev) => ({ ...prev, cart: [{ menuId: 'menu-1', qty: 2, note: '' }] }))

  expect(getSession().cart).toEqual([{ menuId: 'menu-1', qty: 2, note: '' }])

  vi.resetModules()
  const reloaded = await import('./store')
  expect(reloaded.getSession().cart).toHaveLength(1)
})

test('starts empty on corrupt storage', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, '{not-json')

  const { getSession } = await import('./store')
  expect(getSession().cart).toEqual([])
  expect(getSession().orders).toEqual([])
})

test('starts empty on an unknown version', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ v: 99, qr: 'stale' }))

  const { getSession } = await import('./store')
  expect(getSession().qr).toBe('')
})
